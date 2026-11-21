// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { APP_IDS, accessLine, fakeGateway, startApp } from "./helpers.mjs";

const HOSPITAL_ALLERGY = "junctura-hospital:allergy-list";

test("the public config only carries the issuer and the web client id", async () => {
  const app = await startApp();
  try {
    const answer = await app.call("/api/config");
    assert.equal(answer.status, 200);
    assert.deepEqual(Object.keys(answer.body).sort(), ["clientId", "issuer"]);
  } finally { await app.close(); }
});

test("every private route refuses a missing token, and accounts that are not patients", async () => {
  const app = await startApp();
  try {
    for (const path of ["/api/me", "/api/consents", "/api/access", "/api/overview", "/api/emergency", "/api/profile", "/api/options"]) {
      assert.equal((await app.call(path)).status, 401, path);
      assert.equal((await app.call(path, { token: app.signer.sign({ preferred_username: "ysi.tramyte" }) })).status, 403, `${path} for a staff account`);
    }
    assert.equal((await app.call("/api/me", { token: app.signer.sign({ azp: "health-hospital-web" }) })).status, 401);
  } finally { await app.close(); }
});

test("me returns the patient and the code a clinic can find them by", async () => {
  const app = await startApp();
  try {
    const answer = await app.call("/api/me", { token: app.signer.sign() });
    assert.deepEqual(answer.body, { username: "benhnhan.an", displayName: "Nguyễn Văn An", role: "patient", patientCode: "P0001" });
  } finally { await app.close(); }
});

test("options list each place a patient can allow, with plain purposes", async () => {
  const app = await startApp();
  try {
    const { options } = (await app.call("/api/options", { token: app.signer.sign() })).body;
    const option = options.find(item => item.id === HOSPITAL_ALLERGY);
    assert.equal(option.consumerAppId, APP_IDS["junctura-hospital"]);
    assert.equal(option.capabilityId, `urn:junctura:capability:${APP_IDS["junctura-clinic"]}:allergy-list`);
    assert.deepEqual(option.purposes.map(item => item.value), ["treatment", "dispensing"]);
    assert.ok(options.some(item => item.id === "junctura-insurance:claim-verify"));
  } finally { await app.close(); }
});

test("a patient grants a consent, it expires after the chosen days, then revokes it", async () => {
  const app = await startApp();
  const token = app.signer.sign();
  try {
    const granted = await app.call("/api/consents", { token, method: "POST", body: { optionId: HOSPITAL_ALLERGY, purposes: ["treatment"], days: 120 } });
    assert.equal(granted.status, 201);
    assert.equal(granted.body.state, "active");
    assert.equal(granted.body.expiresAt, "2027-03-20T10:00:00.000Z");
    const sent = app.gateway.calls.find(call => call[0] === "grant")[2];
    assert.deepEqual(Object.keys(sent).sort(), ["capabilityId", "consumerAppId", "expiresAt", "purposes"]);
    assert.equal((await app.call("/api/consents", { token })).body.consents.length, 1);
    const revoked = await app.call(`/api/consents/${granted.body.id}/revoke`, { token, method: "POST", body: {} });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.state, "revoked");
  } finally { await app.close(); }
});

test("one patient never sees or revokes another patient's consent", async () => {
  const app = await startApp();
  const an = app.signer.sign();
  const binh = app.signer.sign({ preferred_username: "benhnhan.binh" });
  try {
    const granted = await app.call("/api/consents", { token: an, method: "POST", body: { optionId: HOSPITAL_ALLERGY, purposes: ["treatment"], days: 30 } });
    assert.deepEqual((await app.call("/api/consents", { token: binh })).body.consents, []);
    assert.equal((await app.call(`/api/consents/${granted.body.id}/revoke`, { token: binh, method: "POST", body: {} })).status, 404);
  } finally { await app.close(); }
});

test("a consent request is checked before it reaches Junctura", async () => {
  const app = await startApp();
  const token = app.signer.sign();
  const post = body => app.call("/api/consents", { token, method: "POST", body });
  try {
    for (const body of [
      { optionId: "nope", purposes: ["treatment"], days: 30 },
      { optionId: HOSPITAL_ALLERGY, purposes: [], days: 30 },
      { optionId: HOSPITAL_ALLERGY, purposes: ["claim_review"], days: 30 },
      { optionId: HOSPITAL_ALLERGY, purposes: ["treatment"], days: 0 },
      { optionId: HOSPITAL_ALLERGY, purposes: ["treatment"], days: 366 },
      { optionId: HOSPITAL_ALLERGY, purposes: ["treatment"] },
    ]) assert.equal((await post(body)).status, 422, JSON.stringify(body));
    assert.equal((await app.call("/api/consents", { token, method: "POST" })).status, 422);
    assert.equal(app.gateway.calls.filter(call => call[0] === "grant").length, 0, "nothing invalid is forwarded");
  } finally { await app.close(); }
});

test("an unknown application id means consent cannot be offered, instead of guessing", async () => {
  const app = await startApp({ appIds: { "junctura-clinic": APP_IDS["junctura-clinic"] } });
  try {
    assert.deepEqual((await app.call("/api/options", { token: app.signer.sign() })).body.options, []);
    assert.equal((await app.call("/api/consents", { token: app.signer.sign(), method: "POST", body: { optionId: HOSPITAL_ALLERGY, purposes: ["treatment"], days: 30 } })).status, 422);
  } finally { await app.close(); }
});

test("the access log shows who looked, why, and how it ended; emergencies are separated", async () => {
  const token = "unused";
  const app = await startApp();
  const signed = app.signer.sign();
  app.gateway.accessLog = async () => ({
    entries: [
      accessLine(),
      accessLine({ executionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", state: "failed", purpose: "dispensing" }),
      accessLine({ executionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", emergency: true, review: "pending", accessedAt: "2026-11-19T01:00:00.000Z" }),
    ], truncated: false, generatedAt: "2026-11-20T10:00:00.000Z",
  });
  try {
    const log = (await app.call("/api/access", { token: signed })).body;
    assert.equal(log.entries.length, 3);
    assert.deepEqual(log.entries.map(item => item.outcome), ["done", "blocked", "done"]);
    assert.equal(log.entries[0].who, "Bệnh viện Đà Nẵng");
    assert.equal(log.entries[1].purposeLabel, "Để phát thuốc");
    const emergency = (await app.call("/api/emergency", { token: signed })).body.entries;
    assert.equal(emergency.length, 1);
    assert.equal(emergency[0].review, "pending");
    assert.ok(!JSON.stringify(log).includes("input"), "the log carries no data content");
    assert.ok(token);
  } finally { await app.close(); }
});

test("the overview counts only what Junctura reports", async () => {
  const gateway = fakeGateway();
  const app = await startApp({ gateway });
  const token = app.signer.sign();
  try {
    assert.equal((await app.call("/api/overview", { token })).body.activeConsents, 0);
    await app.call("/api/consents", { token, method: "POST", body: { optionId: HOSPITAL_ALLERGY, purposes: ["treatment"], days: 10 } });
    await app.call("/api/consents", { token, method: "POST", body: { optionId: "junctura-pharmacy:allergy-list", purposes: ["dispensing"], days: 200 } });
    const overview = (await app.call("/api/overview", { token })).body;
    assert.equal(overview.activeConsents, 2);
    assert.equal(overview.parties, 2);
    assert.equal(overview.expiringSoon.length, 1);
    assert.ok(overview.lines.length >= 2);
    assert.deepEqual(overview.places.map(place => [place.who, place.consents.length]), [["junctura-hospital", 1], ["junctura-pharmacy", 1]]);
    assert.equal(overview.daily.length, 14);
    assert.equal(overview.daily.at(-1).date, "2026-11-20");
    assert.deepEqual(overview.recent, []);
    assert.equal(overview.month.month, "2026-11");
    assert.equal(overview.month.granted, 2);
    assert.equal(overview.month.looks, 0);
  } finally { await app.close(); }
});

test("self-declared profile is saved per patient and checked", async () => {
  const app = await startApp();
  const an = app.signer.sign();
  const binh = app.signer.sign({ preferred_username: "benhnhan.binh" });
  try {
    assert.equal((await app.call("/api/profile", { token: an })).body.bloodType, "");
    const saved = await app.call("/api/profile", { token: an, method: "PUT", body: { contactName: "Nguyễn Thị Lan", contactPhone: "0901 234 567", bloodType: "O+", note: "Dị ứng hải sản" } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.contactPhone, "0901234567");
    assert.equal(saved.body.patientCode, "P0001");
    assert.equal((await app.call("/api/profile", { token: binh })).body.contactName, "");
    assert.equal((await app.call("/api/profile", { token: an, method: "PUT", body: { bloodType: "Z" } })).status, 422);
    assert.equal((await app.call("/api/profile", { token: an, method: "PUT", body: { contactPhone: "abc" } })).status, 422);
  } finally { await app.close(); }
});

test("when Junctura is unreachable the patient is told, not shown an empty list", async () => {
  const { GatewayError } = await import("../server/gateway.mjs");
  const gateway = fakeGateway();
  gateway.listConsents = async () => { throw new GatewayError(503, "junctura-unreachable"); };
  const app = await startApp({ gateway });
  try {
    const answer = await app.call("/api/consents", { token: app.signer.sign() });
    assert.equal(answer.status, 503);
    assert.equal(answer.body.error, "junctura-unreachable");
  } finally { await app.close(); }
});

test("without a Junctura address consent routes answer 503", async () => {
  const app = await startApp({ gateway: undefined });
  try { assert.equal((await app.call("/api/consents", { token: app.signer.sign() })).status, 503); } finally { await app.close(); }
});

test("responses carry the security headers", async () => {
  const app = await startApp();
  try {
    const response = await fetch(`${app.base}/healthz`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  } finally { await app.close(); }
});

test("daily activity counts looks per Vietnam day and marks blocked ones", async () => {
  const { dailyActivity, vietnamDay } = await import("../server/overview.mjs");
  const now = new Date("2026-11-20T10:00:00.000Z");
  const days = dailyActivity([
    { at: "2026-11-20T08:00:00.000Z", outcome: "done" },
    { at: "2026-11-20T09:00:00.000Z", outcome: "blocked" },
    { at: "2026-11-19T20:00:00.000Z", outcome: "done" },
    { at: "2026-09-01T00:00:00.000Z", outcome: "done" },
  ], now, 3);
  assert.deepEqual(days, [{ date: "2026-11-18", count: 0, blocked: 0 }, { date: "2026-11-19", count: 0, blocked: 0 }, { date: "2026-11-20", count: 3, blocked: 1 }]);
  assert.equal(vietnamDay("2026-11-19T20:00:00.000Z"), "2026-11-20", "20:00 UTC is already the next day in Vietnam");
});

test("recent keeps the five newest accesses", async () => {
  const gateway = fakeGateway();
  const app = await startApp({ gateway });
  const token = app.signer.sign();
  gateway.accessLog = async () => ({ entries: Array.from({ length: 7 }, (_, index) => accessLine({ executionId: `00000000-0000-4000-8000-00000000000${index}`, accessedAt: `2026-11-1${index}T08:00:00.000Z` })), truncated: false, generatedAt: "" });
  try {
    const { recent } = (await app.call("/api/overview", { token })).body;
    assert.equal(recent.length, 5);
    assert.ok(recent[0].at > recent[4].at);
  } finally { await app.close(); }
});

test("a patient can mark an access line as not recognised, and take the mark back", async () => {
  const app = await startApp();
  const an = app.signer.sign();
  const binh = app.signer.sign({ preferred_username: "benhnhan.binh" });
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  app.gateway.accessLog = async () => ({ entries: [accessLine(), accessLine({ executionId: id })], truncated: false, generatedAt: "2026-11-20T10:00:00.000Z" });
  try {
    const before = (await app.call("/api/access", { token: an })).body.entries;
    assert.ok(before.every(entry => entry.flagged === false));
    assert.deepEqual((await app.call(`/api/access/${id}/flag`, { token: an, method: "POST" })).body, { id, flagged: true });
    assert.deepEqual((await app.call(`/api/access/${id}/flag`, { token: an, method: "POST" })).body, { id, flagged: true }, "marking twice is harmless");
    const marked = (await app.call("/api/access", { token: an })).body.entries;
    assert.deepEqual(marked.filter(entry => entry.flagged).map(entry => entry.id), [id]);
    assert.equal((await app.call("/api/overview", { token: an })).body.flagged, 1);
    assert.equal((await app.call("/api/overview", { token: binh })).body.flagged, 0, "the mark belongs to one patient");
    assert.deepEqual((await app.call(`/api/access/${id}/flag`, { token: an, method: "DELETE" })).body, { id, flagged: false });
    assert.equal((await app.call("/api/overview", { token: an })).body.flagged, 0);
  } finally { await app.close(); }
});

test("only a line of the patient's own access log can be marked", async () => {
  const app = await startApp();
  const an = app.signer.sign();
  try {
    assert.equal((await app.call("/api/access/cccccccc-cccc-4ccc-8ccc-cccccccccccc/flag", { token: an, method: "POST" })).status, 404);
    assert.equal((await app.call("/api/access/not-an-id/flag", { token: an, method: "POST" })).status, 405);
    assert.equal((await app.call("/api/access/cccccccc-cccc-4ccc-8ccc-cccccccccccc/flag", { method: "POST" })).status, 401);
  } finally { await app.close(); }
});
