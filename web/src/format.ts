// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import type { ConsentState, Outcome, Review } from "./types";

const DAY = 86_400_000;

/** Whole days from `now` until `iso` (0 when it is today or already past). */
export const daysLeft = (iso: string, now: Date = new Date()) => Math.max(0, Math.ceil((Date.parse(iso) - now.getTime()) / DAY));

/** "Còn 12 ngày", "Hết hạn hôm nay" – how long a consent still lasts. */
export function remaining(iso: string, now: Date = new Date()): string {
  const days = daysLeft(iso, now);
  return days === 0 ? "Hết hạn hôm nay" : `Còn ${days} ngày`;
}

export const consentStateLabel: Record<ConsentState, string> = { active: "Đang cho phép", expired: "Đã hết hạn", revoked: "Đã thu hồi" };
export const outcomeLabel: Record<Outcome, string> = { done: "Đã xem", pending: "Đang xử lý", blocked: "Bị chặn hoặc không thành công", unknown: "Chưa rõ" };
export const reviewLabel = (review: Review): string => ({
  pending: "Đang chờ cơ quan quản lý rà soát", justified: "Đã rà soát: hợp lý", unjustified: "Đã rà soát: không hợp lý",
})[review ?? "pending"];

/** Folds case and diacritics so "benh vien" finds "Bệnh viện". */
export const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export const DURATIONS = [
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "180", label: "6 tháng" },
  { value: "365", label: "1 năm" },
];

/** Entries whose time falls within the last `days` days; `0` keeps all. */
export const withinDays = <T extends { at: string }>(items: T[], days: number, now: Date = new Date()) =>
  days === 0 ? items : items.filter(item => now.getTime() - Date.parse(item.at) <= days * DAY);

const DAY_FORMAT = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false });
const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** Calendar day (YYYY-MM-DD) in Vietnam time. */
export const dayKey = (value: string | Date) => DAY_FORMAT.format(typeof value === "string" ? new Date(value) : value);
/** "14:05" in Vietnam time. */
export const timeOf = (iso: string) => TIME_FORMAT.format(new Date(iso));

/** "Hôm nay", "Hôm qua" or "Thứ Tư, 18/11/2026" for a day key. */
export function dayHeading(key: string, now: Date = new Date()): string {
  const today = dayKey(now);
  if (key === today) return "Hôm nay";
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "Hôm qua";
  const [year, month, day] = key.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** Groups newest-first entries by day, keeping their order. */
export function groupByDay<T extends { at: string }>(items: T[]): { day: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(item.at);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([day, list]) => ({ day, items: list }));
}
