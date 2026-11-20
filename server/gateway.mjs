// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0

/** A failed call to Junctura: `status` is what to answer the browser, `code` what Junctura said. */
export class GatewayError extends Error {
  constructor(status, code) {
    super(`junctura answered ${status}${code ? ` (${code})` : ""}`);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
  }
}

/**
 * The patient-facing API of Junctura DX-OS (Layer 1): consents and the log of who accessed the
 * caller's data. Every call carries the signed-in patient's own access token, so Junctura answers
 * only about that patient. Nothing is cached or stored here.
 */
export function createGateway({ baseUrl, fetchImpl = fetch, timeoutMs = 8000 }) {
  async function call(token, method, path, body) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        redirect: "error",
        headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(body !== undefined && { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new GatewayError(503, "junctura-unreachable");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new GatewayError(response.status === 401 || response.status === 403 || response.status === 404 || response.status === 400 || response.status === 429 ? response.status : 503, typeof payload?.error === "string" ? payload.error : undefined);
    return payload;
  }
  return Object.freeze({
    listConsents: token => call(token, "GET", "/v1/me/consents"),
    grantConsent: (token, body) => call(token, "POST", "/v1/me/consents", body),
    revokeConsent: (token, consentId) => call(token, "POST", `/v1/me/consents/${encodeURIComponent(consentId)}/revoke`, {}),
    accessLog: token => call(token, "GET", "/v1/me/data-access"),
  });
}
