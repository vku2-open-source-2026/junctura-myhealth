// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { GatewayError, createGateway } from "../server/gateway.mjs";

const respond = (status, body) => ({ ok: status < 400, status, json: async () => body });

test("calls carry the patient's own token and the documented paths", async () => {
  const seen = [];
  const gateway = createGateway({ baseUrl: "http://j.test", fetchImpl: async (url, init) => { seen.push([init.method, url, init.headers.authorization, init.body]); return respond(200, {}); } });
  await gateway.listConsents("T");
  await gateway.accessLog("T");
  await gateway.grantConsent("T", { a: 1 });
  await gateway.revokeConsent("T", "id-1");
  assert.deepEqual(seen, [
    ["GET", "http://j.test/v1/me/consents", "Bearer T", undefined],
    ["GET", "http://j.test/v1/me/data-access", "Bearer T", undefined],
    ["POST", "http://j.test/v1/me/consents", "Bearer T", '{"a":1}'],
    ["POST", "http://j.test/v1/me/consents/id-1/revoke", "Bearer T", "{}"],
  ]);
});

test("Junctura errors keep their meaning; anything else becomes unavailable", async () => {
  const run = (status, body) => createGateway({ baseUrl: "http://j.test", fetchImpl: async () => respond(status, body) }).listConsents("T");
  await assert.rejects(() => run(401, { error: "unauthorized" }), error => error instanceof GatewayError && error.status === 401);
  await assert.rejects(() => run(404, { error: "not_found" }), error => error.status === 404 && error.code === "not_found");
  await assert.rejects(() => run(500, {}), error => error.status === 503);
  const down = createGateway({ baseUrl: "http://j.test", fetchImpl: async () => { throw new Error("connect refused"); } });
  await assert.rejects(() => down.accessLog("T"), error => error.status === 503 && error.code === "junctura-unreachable");
});
