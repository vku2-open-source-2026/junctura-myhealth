// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { BUNDLES, bundleOptions, canRenew, renewalOption, runAll } from "./consentTools";
import type { Consent, ConsentOption } from "./types";

const option = (id: string, consumerName: string, capabilityId: string): ConsentOption => ({
  id, consumerAppId: "a", consumerName, capabilityId, capabilitySlug: id.split(":")[1], shares: "x", fromName: "y", purposes: [{ value: "treatment", label: "t" }], emergencyAccess: false,
});
const consent = (patch: Partial<Consent> = {}): Consent => ({
  id: "c1", who: "Bệnh viện", capabilityId: "cap:allergy", what: "x", purposes: [], createdAt: "2026-11-01T00:00:00.000Z", expiresAt: "2026-12-01T00:00:00.000Z", revokedAt: null, state: "active", ...patch,
});
const now = new Date("2026-11-20T00:00:00.000Z");

describe("consent helpers", () => {
  it("offers only the bundle options that exist and are not allowed yet", () => {
    const options = [option("junctura-hospital:allergy-list", "Bệnh viện", "cap:allergy"), option("junctura-hospital:referral-summary", "Bệnh viện", "cap:referral")];
    const bundle = BUNDLES.find(item => item.id === "hospital-visit")!;
    expect(bundleOptions(bundle, options, []).map(item => item.id)).toEqual(["junctura-hospital:referral-summary", "junctura-hospital:allergy-list"]);
    expect(bundleOptions(bundle, options, [consent()]).map(item => item.id)).toEqual(["junctura-hospital:referral-summary"]);
    expect(bundleOptions(BUNDLES.find(item => item.id === "insurance-claim")!, options, [])).toEqual([]);
  });

  it("matches a place by application id when its display name is longer", () => {
    const options = [{ ...option("junctura-hospital:allergy-list", "Bệnh viện", "cap:allergy"), consumerAppId: "app-h" }];
    const named = consent({ who: "Bệnh viện Đà Nẵng", whoAppId: "app-h" });
    expect(renewalOption(named, options)?.id).toBe("junctura-hospital:allergy-list");
    expect(bundleOptions(BUNDLES[0], options, [named])).toEqual([]);
    expect(renewalOption(consent({ who: "Bệnh viện Đà Nẵng", whoAppId: "other" }), options)).toBeUndefined();
  });

  it("finds the option a consent was given under", () => {
    const options = [option("junctura-hospital:allergy-list", "Bệnh viện", "cap:allergy")];
    expect(renewalOption(consent(), options)?.id).toBe("junctura-hospital:allergy-list");
    expect(renewalOption(consent({ who: "Nhà thuốc" }), options)).toBeUndefined();
  });

  it("allows renewing only active consents close to their end", () => {
    expect(canRenew(consent({ expiresAt: "2026-12-01T00:00:00.000Z" }), now)).toBe(true);
    expect(canRenew(consent({ expiresAt: "2027-03-01T00:00:00.000Z" }), now)).toBe(false);
    expect(canRenew(consent({ state: "revoked" }), now)).toBe(false);
  });

  it("keeps going when one step fails and reports both lists", async () => {
    const result = await runAll([1, 2, 3], async n => { if (n === 2) throw new Error("no"); });
    expect(result).toEqual({ done: [1, 3], failed: [2] });
  });
});
