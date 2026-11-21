// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import type { Consent, ConsentOption } from "./types";

/** Days left at or below which a consent can be renewed. */
export const RENEW_WITHIN_DAYS = 14;

/** A set of consents people usually give together for one errand. */
export interface Bundle { id: string; title: string; description: string; optionIds: string[] }

export const BUNDLES: Bundle[] = [
  { id: "hospital-visit", title: "Đi khám ở bệnh viện", description: "Bệnh viện xem hồ sơ chuyển tuyến, tóm tắt trước khi khám, dị ứng và lịch sử tiêm chủng.",
    optionIds: ["junctura-hospital:referral-summary", "junctura-hospital:pre-visit-summary", "junctura-hospital:allergy-list", "junctura-hospital:vaccination-history"] },
  { id: "buy-medicine", title: "Mua thuốc ở nhà thuốc", description: "Nhà thuốc kiểm tra đơn thuốc và xem danh sách dị ứng để phát thuốc an toàn.",
    optionIds: ["junctura-pharmacy:prescription-verify", "junctura-pharmacy:allergy-list"] },
  { id: "insurance-claim", title: "Thanh toán bảo hiểm y tế", description: "Bảo hiểm chỉ đối chiếu chi phí, không thấy chẩn đoán.",
    optionIds: ["junctura-insurance:claim-verify"] },
];

/** Same place (by application id, as the name a place shows can be longer) and same kind of data. */
const sameOption = (consent: Consent, option: ConsentOption) =>
  consent.capabilityId === option.capabilityId && (consent.whoAppId ? consent.whoAppId === option.consumerAppId : consent.who === option.consumerName);

/** Options the person has not allowed yet. */
export const notAllowed = (options: ConsentOption[], active: Consent[]) => options.filter(option => !active.some(item => sameOption(item, option)));

/** The options of a bundle that exist in this setup and are not allowed yet. */
export function bundleOptions(bundle: Bundle, options: ConsentOption[], active: Consent[]): ConsentOption[] {
  return notAllowed(bundle.optionIds.flatMap(id => options.find(option => option.id === id) ?? []), active);
}

/** The option a consent was given under, so it can be given again. */
export const renewalOption = (consent: Consent, options: ConsentOption[]) => options.find(option => sameOption(consent, option));

export const canRenew = (consent: Consent, now: Date = new Date()) =>
  consent.state === "active" && Date.parse(consent.expiresAt) - now.getTime() <= RENEW_WITHIN_DAYS * 86_400_000;

/** Runs `step` for every item one after another and keeps going when one fails. */
export async function runAll<T>(items: T[], step: (item: T) => Promise<unknown>): Promise<{ done: T[]; failed: T[] }> {
  const done: T[] = [];
  const failed: T[] = [];
  for (const item of items) {
    try { await step(item); done.push(item); } catch { failed.push(item); }
  }
  return { done, failed };
}
