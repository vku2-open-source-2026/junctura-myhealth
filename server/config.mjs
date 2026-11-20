// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "./env.mjs";

const DEFAULT_PORT = 5183;

/**
 * Configuration comes from the environment. For the local demo, the credentials file that
 * `npm run demo:setup` (junctura-health) wrote for this app is read too; real environment
 * variables win over the file. Nothing here is sent to a browser except the public issuer and
 * the public web client id. MyHealth holds no backend secret: it forwards the signed-in
 * person's own token to Junctura, so Junctura decides what that person may see and change.
 */
export function loadConfig({ env = process.env, cwd = process.cwd() } = {}) {
  const healthDir = resolve(cwd, env.JUNCTURA_HEALTH_DIR ?? "../junctura-health");
  const envFile = resolve(cwd, env.JUNCTURA_MYHEALTH_ENV ?? `${healthDir}/.junctura/demo/junctura-myhealth.env`);
  const fromFile = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  const get = key => env[key] ?? fromFile[key];

  const issuer = get("JUNCTURA_ISSUER");
  const webClientId = get("JUNCTURA_WEB_CLIENT_ID");
  if (!issuer || !webClientId) {
    throw new Error("JUNCTURA_ISSUER and JUNCTURA_WEB_CLIENT_ID are required. Run `npm run demo:setup` in junctura-health, or set them in the environment.");
  }
  const port = Number(get("PORT") ?? get("WEB_PORT") ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError("PORT must be a valid port number");
  const baseUrl = get("JUNCTURA_URL");
  if (baseUrl && !/^https?:\/\//.test(baseUrl)) throw new Error("JUNCTURA_URL must start with http:// or https://");
  return Object.freeze({
    /** Gateway of Junctura DX-OS (Layer 1); null when not set, and then consent calls answer 503. */
    junctura: baseUrl ? Object.freeze({ baseUrl: baseUrl.replace(/\/+$/, "") }) : null,
    issuer: issuer.replace(/\/+$/, ""),
    /** Where to fetch the signing keys when the public issuer address is not reachable from here (for example inside a container). Tokens are still checked against `issuer`. */
    issuerInternal: (get("JUNCTURA_ISSUER_INTERNAL") ?? issuer).replace(/\/+$/, ""),
    webClientId,
    port,
    host: get("HOST") ?? "127.0.0.1",
    healthDir,
    dbFile: resolve(cwd, get("MYHEALTH_DB") ?? "data/myhealth.db"),
    staticDir: resolve(cwd, get("MYHEALTH_STATIC_DIR") ?? "web/dist"),
  });
}
