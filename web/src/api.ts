// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { freshAccessToken, type OidcSettings } from "./auth";
import type { AccessEntry, Consent, ConsentOption, Me, Overview, Profile, ProfileInput, PublicConfig } from "./types";

/** `code` is the server's error name (for example "invalid"); `body` is the whole answer. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly body: Record<string, unknown> = {}) {
    super(message);
  }
  get code(): string | undefined { return typeof this.body.error === "string" ? this.body.error : undefined; }
  /** Field messages of a 422 answer, keyed by field name. */
  get fields(): Record<string, string> { return (this.body.fields as Record<string, string> | undefined) ?? {}; }
}

async function request<T>(path: string, settings?: OidcSettings, signal?: AbortSignal, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (settings) {
    const token = await freshAccessToken(settings);
    if (!token) throw new ApiError(401, "unauthenticated");
    headers.authorization = `Bearer ${token}`;
  }
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(path, { method: init.method, headers, signal, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, `request failed (${response.status})`, body && typeof body === "object" ? body : {});
  }
  return response.json();
}

const enc = encodeURIComponent;

export const getConfig = () => request<PublicConfig>("/api/config");
export const getMe = (settings: OidcSettings) => request<Me>("/api/me", settings);
export const getOverview = (settings: OidcSettings, signal?: AbortSignal) => request<Overview>("/api/overview", settings, signal);
export const getOptions = (settings: OidcSettings, signal?: AbortSignal) => request<{ options: ConsentOption[] }>("/api/options", settings, signal).then(body => body.options);
export const getConsents = (settings: OidcSettings, signal?: AbortSignal) => request<{ consents: Consent[] }>("/api/consents", settings, signal).then(body => body.consents);
export const getAccess = (settings: OidcSettings, signal?: AbortSignal) => request<{ entries: AccessEntry[]; truncated: boolean; generatedAt: string }>("/api/access", settings, signal);
export const getEmergency = (settings: OidcSettings, signal?: AbortSignal) => request<{ entries: AccessEntry[] }>("/api/emergency", settings, signal).then(body => body.entries);
export const getProfile = (settings: OidcSettings, signal?: AbortSignal) => request<Profile>("/api/profile", settings, signal);

export const grantConsent = (settings: OidcSettings, body: { optionId: string; purposes: string[]; days: number }) =>
  request<Consent>("/api/consents", settings, undefined, { method: "POST", body });
export const revokeConsent = (settings: OidcSettings, id: string) => request<Consent>(`/api/consents/${enc(id)}/revoke`, settings, undefined, { method: "POST", body: {} });
export const saveProfile = (settings: OidcSettings, body: ProfileInput) => request<Profile>("/api/profile", settings, undefined, { method: "PUT", body });
