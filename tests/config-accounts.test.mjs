// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPatients } from "../server/accounts.mjs";
import { loadConfig } from "../server/config.mjs";
import { APP_LABEL, consentOptions, loadAppIds } from "../server/directory.mjs";
import { parseEnv } from "../server/env.mjs";
import { APP_IDS } from "./helpers.mjs";

const healthDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "myhealth-health-"));
  mkdirSync(join(dir, "seed/data"), { recursive: true });
  mkdirSync(join(dir, ".junctura/demo"), { recursive: true });
  writeFileSync(join(dir, "seed/data/accounts.json"), JSON.stringify({ users: [
    { subject: "s-an", username: "benhnhan.an", displayName: "Nguyễn Văn An", role: "patient", app: "junctura-myhealth" },
    { subject: "s-ys", username: "ysi.tramyte", displayName: "Y sĩ", role: "clinic-staff", app: "junctura-clinic" },
    { subject: "s-x", username: "lạ", displayName: "Lạ", role: "guest", app: "junctura-myhealth" },
  ] }));
  writeFileSync(join(dir, "seed/data/clinic.json"), JSON.stringify({ patients: [{ subject: "s-an", patientId: "P0001" }] }));
  writeFileSync(join(dir, ".junctura/demo/junctura-hospital.env"), `JUNCTURA_APP_ID=${APP_IDS["junctura-hospital"]}\n`);
  writeFileSync(join(dir, ".junctura/demo/junctura-clinic.env"), `JUNCTURA_APP_ID=${APP_IDS["junctura-clinic"]}\n`);
  return dir;
};

test("parseEnv reads KEY=VALUE lines and ignores comments", () => {
  assert.deepEqual(parseEnv("# c\nA=1\n B = \"two words\" \n\n#D=4\n"), { A: "1", B: "two words" });
});

test("config requires the Junctura issuer and web client", () => {
  assert.throws(() => loadConfig({ env: { JUNCTURA_MYHEALTH_ENV: "/nonexistent.env" } }), /JUNCTURA_ISSUER/);
});

test("config reads the demo credentials file, lets the environment win, and needs no secret", () => {
  const dir = mkdtempSync(join(tmpdir(), "myhealth-env-"));
  const file = join(dir, "m.env");
  writeFileSync(file, "JUNCTURA_URL=http://localhost:8080/\nJUNCTURA_ISSUER=https://id.example.test/identity/realms/junctura/\nJUNCTURA_WEB_CLIENT_ID=health-myhealth-web\nWEB_PORT=5183\nJUNCTURA_APP_CLIENT_SECRET=never-used\n");
  const config = loadConfig({ env: { JUNCTURA_MYHEALTH_ENV: file }, cwd: dir });
  assert.equal(config.issuer, "https://id.example.test/identity/realms/junctura");
  assert.equal(config.junctura.baseUrl, "http://localhost:8080");
  assert.equal(config.port, 5183);
  assert.equal(config.issuerInternal, config.issuer);
  assert.ok(!JSON.stringify(config).includes("never-used"), "the backend secret is never loaded");
  assert.equal(loadConfig({ env: { JUNCTURA_MYHEALTH_ENV: file, PORT: "6000" }, cwd: dir }).port, 6000);
  assert.throws(() => loadConfig({ env: { JUNCTURA_MYHEALTH_ENV: file, PORT: "99999" }, cwd: dir }), /PORT/);
  assert.throws(() => loadConfig({ env: { JUNCTURA_MYHEALTH_ENV: file, JUNCTURA_URL: "ftp://x" }, cwd: dir }), /JUNCTURA_URL/);
});

test("only patient accounts of this app can sign in, each with their clinic code", () => {
  const patients = loadPatients(healthDir());
  assert.deepEqual([...patients.keys()], ["benhnhan.an"]);
  assert.equal(patients.get("benhnhan.an").patientCode, "P0001");
});

test("application ids come from the demo credential files, and options need both sides", () => {
  const ids = loadAppIds(healthDir());
  assert.deepEqual(Object.keys(ids).sort(), ["junctura-clinic", "junctura-hospital"]);
  const options = consentOptions(ids);
  assert.ok(options.length > 0 && options.every(option => option.consumerName === APP_LABEL["junctura-hospital"]));
  assert.deepEqual(consentOptions({}), []);
});
