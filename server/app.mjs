// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { consentOptions } from "./directory.mjs";
import { GatewayError } from "./gateway.mjs";
import { AuthError } from "./jwt.mjs";
import { accessEntry, buildOverview, consentView } from "./overview.mjs";
import { BLOOD_TYPES } from "./profile.mjs";
import { ValidationError, check, integer, oneOf, pattern, text } from "./validate.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".ico": "image/x-icon", ".png": "image/png", ".txt": "text/plain; charset=utf-8",
};

const securityHeaders = config => ({
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": [
    "default-src 'self'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'",
    `connect-src 'self' ${new URL(config.issuer).origin}`, "img-src 'self' data:", "style-src 'self' 'unsafe-inline'",
  ].join("; "),
});

const MAX_BODY = 16 * 1024;
const MAX_DAYS = 365;
const DAY = 86_400_000;

class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/**
 * Request handler of the MyHealth server: a small JSON API behind Junctura sign-in plus the built
 * web UI. Only patient accounts of this application get in. Consents and the access log are asked
 * from Junctura with the patient's own token, so a patient can only ever see and change their own.
 */
export function createApp({ config, patients, verifier, gateway, profiles, appIds = {}, now = () => new Date() }) {
  const base = securityHeaders(config);

  const send = (res, status, body, headers = {}) => {
    const payload = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
    res.writeHead(status, { ...base, "cache-control": "no-store", ...(payload && { "content-type": "application/json; charset=utf-8" }), ...headers });
    res.end(payload);
  };

  async function authenticate(req) {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
    if (!match) throw new AuthError("sign in required");
    const claims = await verifier(match[1]);
    const user = patients.get(claims.preferred_username);
    return user ? { user, token: match[1] } : null;
  }

  async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new HttpError(413, "payload-too-large");
      chunks.push(chunk);
    }
    if (size === 0) return null;
    if (!/^application\/json(;|$)/i.test(req.headers["content-type"] ?? "")) throw new HttpError(415, "unsupported-media-type");
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ValidationError({ _: "Dữ liệu gửi lên không đọc được." });
    }
  }

  const gatewayOrFail = () => {
    if (!gateway) throw new HttpError(503, "junctura-not-configured");
    return gateway;
  };
  const loadConsents = async token => (await gatewayOrFail().listConsents(token)).consents.map(consentView);
  const loadAccess = async token => (await gatewayOrFail().accessLog(token)).entries.map(accessEntry);

  async function route(req, url, { user, token }) {
    const { method } = req;
    const path = url.pathname;
    const reading = method === "GET" || method === "HEAD";
    let match;

    if (reading) {
      if (path === "/api/me") return [200, { username: user.username, displayName: user.displayName, role: user.role, patientCode: user.patientCode }];
      if (path === "/api/options") return [200, { options: consentOptions(appIds) }];
      if (path === "/api/consents") return [200, { consents: await loadConsents(token) }];
      if (path === "/api/access") {
        const log = await gatewayOrFail().accessLog(token);
        const flagged = profiles.flags.list(user.subject);
        return [200, { entries: log.entries.map(accessEntry).map(entry => ({ ...entry, flagged: flagged.has(entry.id) })), truncated: log.truncated === true, generatedAt: log.generatedAt }];
      }
      if (path === "/api/emergency") return [200, { entries: (await loadAccess(token)).filter(item => item.emergency) }];
      if (path === "/api/overview") {
        const [consents, access] = await Promise.all([loadConsents(token), loadAccess(token)]);
        const flagged = profiles.flags.list(user.subject);
        return [200, { ...buildOverview({ consents, access, now: now() }), flagged: access.filter(item => flagged.has(item.id)).length }];
      }
      if (path === "/api/profile") return [200, { ...profiles.get(user.subject), patientCode: user.patientCode }];
      return undefined;
    }

    if (method === "PUT" && path === "/api/profile") {
      const input = check(await readBody(req), {
        contactName: text("Tên người liên hệ", { max: 80, required: false }),
        contactPhone: v => pattern("Số điện thoại", /^\+?\d{8,15}$/, "8 đến 15 chữ số", { normalize: value => value.replace(/[\s.-]/g, "") })(v),
        bloodType: oneOf("nhóm máu", BLOOD_TYPES, { required: false }),
        note: text("Ghi chú", { max: 500, required: false }),
      });
      return [200, { ...profiles.save(user.subject, input, now()), patientCode: user.patientCode }];
    }

    if ((method === "POST" || method === "DELETE") && (match = /^\/api\/access\/([0-9a-f-]{36})\/flag$/.exec(path))) {
      if (!(await loadAccess(token)).some(item => item.id === match[1])) throw new HttpError(404, "not-found");
      if (method === "POST") profiles.flags.add(user.subject, match[1], now());
      else profiles.flags.remove(user.subject, match[1]);
      return [200, { id: match[1], flagged: method === "POST" }];
    }

    if (method === "POST" && path === "/api/consents") {
      const options = consentOptions(appIds);
      const input = check(await readBody(req), {
        optionId: oneOf("nơi và loại dữ liệu", options.map(option => option.id)),
        days: integer("Số ngày", 1, MAX_DAYS),
        purposes: value => {
          if (!Array.isArray(value) || value.length === 0) throw new RangeError("Chọn ít nhất một mục đích.");
          return [...new Set(value)];
        },
      });
      const option = options.find(item => item.id === input.optionId);
      const allowed = option.purposes.map(item => item.value);
      if (!input.purposes.every(item => allowed.includes(item))) throw new ValidationError({ purposes: "Mục đích không nằm trong danh sách cho phép." });
      const created = await gatewayOrFail().grantConsent(token, {
        consumerAppId: option.consumerAppId,
        capabilityId: option.capabilityId,
        purposes: input.purposes,
        expiresAt: new Date(now().getTime() + input.days * DAY).toISOString(),
      });
      return [201, consentView(created)];
    }
    if (method === "POST" && (match = /^\/api\/consents\/([0-9a-f-]{36})\/revoke$/.exec(path))) {
      return [200, consentView(await gatewayOrFail().revokeConsent(token, match[1]))];
    }
    if (!reading && (path === "/api/profile" || path === "/api/consents" || /^\/api\/consents\//.test(path) || /^\/api\/access\//.test(path))) return [405, { error: "method-not-allowed" }];
    return undefined;
  }

  function answerFailure(res, error) {
    if (error instanceof ValidationError) return send(res, 422, { error: "invalid", fields: error.fields }), true;
    if (error instanceof HttpError) return send(res, error.status, { error: error.code, ...error.extra }), true;
    if (error instanceof GatewayError) {
      if (error.status === 401) return send(res, 401, { error: "unauthenticated" }, { "www-authenticate": "Bearer" }), true;
      if (error.status >= 500) console.error(error.message);
      return send(res, error.status, { error: error.code ?? (error.status === 503 ? "junctura-unavailable" : "rejected") }), true;
    }
    return false;
  }

  async function api(req, res, url) {
    if (url.pathname === "/api/config") {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method-not-allowed" }, { allow: "GET, HEAD" });
      return send(res, 200, { issuer: config.issuer, clientId: config.webClientId });
    }
    let session;
    try {
      session = await authenticate(req);
    } catch (error) {
      if (!(error instanceof AuthError)) console.error(`token check failed: ${error.message}`);
      return send(res, 401, { error: "unauthenticated" }, { "www-authenticate": "Bearer" });
    }
    if (!session) return send(res, 403, { error: "not-a-patient" });
    try {
      const result = await route(req, url, session);
      return result ? send(res, result[0], result[1]) : send(res, 404, { error: "not-found" });
    } catch (error) {
      if (answerFailure(res, error)) return;
      throw error;
    }
  }

  function serveStatic(res, pathname) {
    const target = normalize(join(config.staticDir, pathname === "/" ? "index.html" : pathname));
    const root = config.staticDir + sep;
    let file = target.startsWith(root) && existsSync(target) && statSync(target).isFile() ? target : null;
    // Unknown paths without an extension belong to the single-page app.
    if (!file && !extname(pathname)) file = join(config.staticDir, "index.html");
    if (!file || !existsSync(file)) return send(res, 404, { error: "not-found" });
    const immutable = pathname.startsWith("/assets/");
    res.writeHead(200, { ...base, "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache" });
    createReadStream(file).pipe(res);
  }

  return async function handle(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/healthz") return send(res, 200, { status: "ok" });
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method-not-allowed" }, { allow: "GET, HEAD" });
      return serveStatic(res, decodeURIComponent(url.pathname));
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(res, 500, { error: "internal-error" });
      else res.end();
    }
  };
}
