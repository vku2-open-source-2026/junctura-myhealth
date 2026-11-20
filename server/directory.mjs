// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { CONTRACTS } from "@junctura/health-contracts";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "./env.mjs";

/** How each Junctura Health application is named to a patient. */
export const APP_LABEL = Object.freeze({
  "junctura-clinic": "Trạm Y tế",
  "junctura-hospital": "Bệnh viện",
  "junctura-pharmacy": "Nhà thuốc",
  "junctura-insurance": "Bảo hiểm y tế",
  "junctura-myhealth": "Sổ sức khỏe",
});

/** Why a place asks, in words a patient uses. A purpose not listed is shown as it is. */
export const PURPOSE_LABEL = Object.freeze({
  treatment: "Để điều trị",
  referral_intake: "Để tiếp nhận chuyển tuyến",
  dispensing: "Để phát thuốc",
  claim_review: "Để giám định chi phí bảo hiểm",
});

/** What each kind of sharing means, one sentence, without medical detail. */
export const SHARE_LABEL = Object.freeze({
  "referral-summary": "Hồ sơ chuyển tuyến từ trạm y tế",
  "pre-visit-summary": "Tóm tắt trước khi khám",
  "allergy-list": "Danh sách dị ứng",
  "vaccination-history": "Lịch sử tiêm chủng",
  "prescription-verify": "Kiểm tra đơn thuốc",
  "claim-verify": "Đối chiếu chi phí điều trị",
});

/** Application ids that `demo:setup` wrote next to each app's credentials; `{ "junctura-hospital": "uuid", ... }`. */
export function loadAppIds(healthDir) {
  const ids = {};
  for (const name of Object.keys(APP_LABEL)) {
    const file = resolve(healthDir, ".junctura/demo", `${name}.env`);
    if (!existsSync(file)) continue;
    const id = parseEnv(readFileSync(file, "utf8")).JUNCTURA_APP_ID;
    if (id) ids[name] = id;
  }
  return Object.freeze(ids);
}

/**
 * What a patient can allow: one entry per (capability, consumer) pair in the shared contracts. Pairs
 * whose application ids are not known yet (demo not set up) are left out rather than guessed.
 */
export function consentOptions(appIds, contracts = CONTRACTS) {
  return contracts.flatMap(contract => contract.consumers.map(consumer => {
    const providerId = appIds[contract.provider];
    const consumerId = appIds[consumer];
    if (!providerId || !consumerId) return null;
    return {
      id: `${consumer}:${contract.slug}`,
      consumerAppId: consumerId,
      consumerName: APP_LABEL[consumer] ?? consumer,
      capabilityId: `urn:junctura:capability:${providerId}:${contract.slug}`,
      capabilitySlug: contract.slug,
      shares: SHARE_LABEL[contract.slug] ?? contract.title,
      fromName: APP_LABEL[contract.provider] ?? contract.provider,
      purposes: contract.purposes.map(value => ({ value, label: PURPOSE_LABEL[value] ?? value })),
      emergencyAccess: contract.emergencyAccess,
    };
  })).filter(Boolean);
}
