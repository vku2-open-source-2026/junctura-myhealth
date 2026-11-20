// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { createSign, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import { createApp } from "../server/app.mjs";
import { createVerifier } from "../server/jwt.mjs";
import { openProfiles } from "../server/profile.mjs";

export const ISSUER = "https://id.example.test/identity/realms/junctura";
export const CLIENT = "health-myhealth-web";
export const NOW = new Date("2026-11-20T10:00:00.000Z");

export const APP_IDS = Object.freeze({
  "junctura-clinic": "11111111-1111-4111-8111-111111111111",
  "junctura-hospital": "22222222-2222-4222-8222-222222222222",
  "junctura-pharmacy": "44444444-4444-4444-8444-444444444444",
  "junctura-insurance": "55555555-5555-4555-8555-555555555555",
  "junctura-myhealth": "33333333-3333-4333-8333-333333333333",
});

export const PATIENTS = new Map([
  ["benhnhan.an", Object.freeze({ username: "benhnhan.an", subject: "s-an", displayName: "Nguyễn Văn An", role: "patient", patientCode: "P0001" })],
  ["benhnhan.binh", Object.freeze({ username: "benhnhan.binh", subject: "s-binh", displayName: "Trần Thị Bình", role: "patient", patientCode: "P0002" })],
]);

export function makeSigner(kid = "k1") {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, use: "sig", alg: "RS256" };
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const sign = (claims = {}, { header = {}, key = privateKey } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const body = { iss: ISSUER, azp: CLIENT, exp: now + 300, preferred_username: "benhnhan.an", ...claims };
    const head = encode({ alg: "RS256", typ: "JWT", kid, ...header });
    const input = `${head}.${encode(body)}`;
    return `${input}.${createSign("RSA-SHA256").update(input).sign(key).toString("base64url")}`;
  };
  return { jwk, sign, privateKey };
}

/**
 * A stand-in for Junctura's patient API that remembers what it was asked, keyed by token so one
 * patient can never see another's consents. It follows the documented shapes of /v1/me/*.
 */
export function fakeGateway({ access = {} } = {}) {
  const consents = new Map();
  const calls = [];
  let counter = 0;
  const forToken = token => consents.get(token) ?? consents.set(token, []).get(token);
  return {
    calls,
    listConsents: async token => { calls.push(["list", token]); return { consents: forToken(token) }; },
    grantConsent: async (token, body) => {
      calls.push(["grant", token, body]);
      const id = `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
      const app = Object.entries(APP_IDS).find(([, value]) => value === body.consumerAppId)?.[0] ?? "unknown";
      const consent = { consentId: id, consumer: { appId: body.consumerAppId, displayName: app }, capabilityId: body.capabilityId, capabilityTitle: body.capabilityId.split(":").at(-1),
        purposes: body.purposes, createdAt: NOW.toISOString(), expiresAt: body.expiresAt, revokedAt: null, state: "active" };
      forToken(token).push(consent);
      return consent;
    },
    revokeConsent: async (token, id) => {
      calls.push(["revoke", token, id]);
      const consent = forToken(token).find(item => item.consentId === id);
      if (!consent) { const { GatewayError } = await import("../server/gateway.mjs"); throw new GatewayError(404, "not_found"); }
      Object.assign(consent, { state: "revoked", revokedAt: NOW.toISOString() });
      return consent;
    },
    accessLog: async token => { calls.push(["access", token]); return { entries: access[token] ?? [], truncated: false, generatedAt: NOW.toISOString() }; },
  };
}

export const accessLine = (patch = {}) => ({
  executionId: "99999999-9999-4999-8999-999999999999", accessedAt: "2026-11-18T08:00:00.000Z", purpose: "treatment", state: "succeeded",
  consumer: { appId: APP_IDS["junctura-hospital"], displayName: "Bệnh viện Đà Nẵng" }, provider: { appId: APP_IDS["junctura-clinic"], displayName: "Trạm Y tế" },
  capability: { capabilityId: `urn:junctura:capability:${APP_IDS["junctura-clinic"]}:allergy-list`, version: "1.0.0", title: "Danh sách dị ứng" },
  emergency: false, review: null, ...patch,
});

/** Starts the real app on an ephemeral port with a fake identity provider key set and a fake Junctura. */
export async function startApp(options = {}) {
  const { staticDir = "/nonexistent", appIds = APP_IDS } = options;
  const gateway = "gateway" in options ? options.gateway : fakeGateway();
  const signer = makeSigner();
  const config = { issuer: ISSUER, webClientId: CLIENT, staticDir };
  const verifier = createVerifier({ issuer: ISSUER, clientId: CLIENT, getJson: async () => ({ keys: [signer.jwk] }) });
  const profiles = openProfiles(":memory:");
  const server = createServer(createApp({ config, patients: PATIENTS, verifier, gateway, profiles, appIds, now: () => NOW }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { token, method = "GET", body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(token && { authorization: `Bearer ${token}` }), ...(body !== undefined && { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  return { signer, base, gateway, call, close: () => new Promise(resolve => server.close(resolve).on("close", () => profiles.close())) };
}
