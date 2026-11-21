// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { PURPOSE_LABEL } from "./directory.mjs";

const DAY = 86_400_000;
const VIETNAM_OFFSET = 7 * 3_600_000;

/** Calendar day (YYYY-MM-DD) of an instant in Vietnam time, so "today" matches what the patient sees. */
export const vietnamDay = value => new Date((value instanceof Date ? value.getTime() : Date.parse(value)) + VIETNAM_OFFSET).toISOString().slice(0, 10);

/** One bucket per day for the last `days` days, oldest first, counting looks and blocked looks. */
export function dailyActivity(access, now, days = 14) {
  const buckets = new Map();
  for (let back = days - 1; back >= 0; back--) buckets.set(vietnamDay(new Date(now.getTime() - back * DAY)), { count: 0, blocked: 0 });
  for (const item of access) {
    const bucket = buckets.get(vietnamDay(item.at));
    if (!bucket) continue;
    bucket.count++;
    if (item.outcome === "blocked") bucket.blocked++;
  }
  return [...buckets].map(([date, value]) => ({ date, ...value }));
}

/** Active consents grouped by the place they were given to, in the order of first appearance. */
export function groupByPlace(consents) {
  const places = new Map();
  for (const item of consents) {
    const key = item.whoAppId ?? item.who;
    if (!places.has(key)) places.set(key, { who: item.who, whoAppId: item.whoAppId, consents: [] });
    places.get(key).consents.push(item);
  }
  return [...places.values()];
}

/** How a capability call ended, in the three words a patient needs. */
export const outcomeOf = state => {
  if (state === "succeeded") return "done";
  if (state === "accepted" || state === "running") return "pending";
  if (state === "failed" || state === "auth_required" || state === "cancelled" || state === "timed_out") return "blocked";
  return "unknown";
};

/** One line of Junctura's access log, shaped for the screen. Nothing about the data itself is in the log. */
export const accessEntry = entry => Object.freeze({
  id: entry.executionId,
  at: entry.accessedAt,
  who: entry.consumer?.displayName ?? "Một ứng dụng chưa đặt tên",
  whoAppId: entry.consumer?.appId,
  provider: entry.provider?.displayName ?? null,
  what: entry.capability?.title ?? entry.capability?.capabilityId ?? "Dữ liệu",
  purpose: entry.purpose,
  purposeLabel: PURPOSE_LABEL[entry.purpose] ?? entry.purpose,
  outcome: outcomeOf(entry.state),
  emergency: entry.emergency === true,
  review: entry.review ?? null,
});

/** The consent as the screen shows it. `state` is Junctura's: active, expired or revoked. */
export const consentView = consent => Object.freeze({
  id: consent.consentId,
  who: consent.consumer?.displayName ?? "Một ứng dụng chưa đặt tên",
  whoAppId: consent.consumer?.appId,
  what: consent.capabilityTitle ?? consent.capabilityId,
  capabilityId: consent.capabilityId,
  purposes: consent.purposes.map(value => ({ value, label: PURPOSE_LABEL[value] ?? value })),
  createdAt: consent.createdAt,
  expiresAt: consent.expiresAt,
  revokedAt: consent.revokedAt ?? null,
  state: consent.state,
});

const monthOf = value => vietnamDay(value).slice(0, 7);
const monthLabel = key => `${key.slice(5)}/${key.slice(0, 4)}`;

/**
 * What happened to the patient's data this calendar month (Vietnam time), in a few plain sentences.
 * Fixed rules over the access log and the consents, no model. It never mentions what was read, since
 * the log does not hold that.
 */
export function buildMonthSummary({ consents, access, now = new Date() }) {
  const month = monthOf(now);
  const [year, number] = month.split("-").map(Number);
  const previous = `${number === 1 ? year - 1 : year}-${String(number === 1 ? 12 : number - 1).padStart(2, "0")}`;
  const looks = access.filter(item => monthOf(item.at) === month);
  const previousLooks = access.filter(item => monthOf(item.at) === previous).length;
  const byPlace = new Map();
  for (const item of looks) {
    const key = item.whoAppId ?? item.who;
    byPlace.set(key, { who: item.who, count: (byPlace.get(key)?.count ?? 0) + 1 });
  }
  const top = [...byPlace.values()].sort((a, b) => b.count - a.count || a.who.localeCompare(b.who, "vi"))[0] ?? null;
  const blocked = looks.filter(item => item.outcome === "blocked").length;
  const emergency = looks.filter(item => item.emergency).length;
  const granted = consents.filter(item => monthOf(item.createdAt) === month).length;
  const revoked = consents.filter(item => item.revokedAt && monthOf(item.revokedAt) === month).length;
  const label = monthLabel(month);

  const lines = [];
  lines.push(looks.length === 0
    ? `Tháng ${label} chưa có ai truy cập dữ liệu của bạn.`
    : `Tháng ${label} có ${looks.length} lượt truy cập dữ liệu của bạn từ ${byPlace.size} nơi.`);
  if (top && byPlace.size > 1) lines.push(`Nơi xem nhiều nhất là ${top.who} (${top.count} lượt).`);
  if (looks.length > 0 || previousLooks > 0) {
    lines.push(looks.length === previousLooks ? `Bằng tháng trước (${previousLooks} lượt).`
      : `${looks.length > previousLooks ? "Nhiều" : "Ít"} hơn tháng trước (${previousLooks} lượt).`);
  }
  if (blocked > 0) lines.push(`${blocked} lượt bị chặn hoặc không thành công.`);
  if (emergency > 0) lines.push(`${emergency} lượt là truy cập cấp cứu.`);
  if (granted > 0 || revoked > 0) lines.push(`Bạn đã cho phép ${granted} lần và thu hồi ${revoked} lần.`);
  return { month, label, looks: looks.length, places: byPlace.size, previousLooks, blocked, emergency, granted, revoked, topPlace: top, lines };
}

/**
 * The home screen in numbers and in plain sentences. `now` is injected so tests do not depend on the
 * clock. Counts only what Junctura reports; a person with no consents sees zeros, not an error.
 */
export function buildOverview({ consents, access, now = new Date() }) {
  const t = now.getTime();
  const active = consents.filter(item => item.state === "active");
  const parties = new Set(active.map(item => item.whoAppId ?? item.who));
  const expiringSoon = active.filter(item => Date.parse(item.expiresAt) - t <= 14 * DAY).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const recent = access.filter(item => t - Date.parse(item.at) <= 30 * DAY);
  const last = access.reduce((best, item) => (!best || item.at > best.at ? item : best), null);
  const pendingEmergency = access.filter(item => item.emergency && item.review === "pending");
  const lines = [];
  lines.push(active.length === 0 ? "Hiện chưa có nơi nào được phép xem dữ liệu của bạn." : `Hiện có ${parties.size} nơi được phép xem dữ liệu của bạn (${active.length} sự đồng ý còn hiệu lực).`);
  lines.push(recent.length === 0 ? "Trong 30 ngày qua không có ai truy cập dữ liệu của bạn." : `Trong 30 ngày qua có ${recent.length} lượt truy cập dữ liệu của bạn từ ${new Set(recent.map(item => item.whoAppId ?? item.who)).size} nơi.`);
  if (pendingEmergency.length) lines.push(`Có ${pendingEmergency.length} lần truy cập cấp cứu đang chờ rà soát. Bạn có thể xem lý do ở mục Cấp cứu.`);
  if (expiringSoon.length) lines.push(`${expiringSoon.length} sự đồng ý sẽ hết hạn trong 14 ngày tới.`);
  return {
    activeConsents: active.length,
    parties: parties.size,
    accessLast30Days: recent.length,
    pendingEmergency: pendingEmergency.length,
    lastAccess: last,
    expiringSoon,
    places: groupByPlace(active),
    daily: dailyActivity(access, now),
    recent: [...access].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5),
    lines,
    month: buildMonthSummary({ consents, access, now }),
  };
}
