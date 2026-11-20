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
  };
}
