// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0

export interface PublicConfig { issuer: string; clientId: string }
export interface Me { username: string; displayName: string; role: string; patientCode: string | null }

export interface Purpose { value: string; label: string }

/** One thing a patient can allow: a place (consumer) reading one kind of data for stated purposes. */
export interface ConsentOption {
  id: string; consumerAppId: string; consumerName: string; capabilityId: string; capabilitySlug: string;
  shares: string; fromName: string; purposes: Purpose[]; emergencyAccess: boolean;
}

export type ConsentState = "active" | "expired" | "revoked";
export interface Consent {
  id: string; who: string; whoAppId?: string; what: string; capabilityId: string; purposes: Purpose[];
  createdAt: string; expiresAt: string; revokedAt: string | null; state: ConsentState;
}

export type Outcome = "done" | "pending" | "blocked" | "unknown";
export type Review = "pending" | "justified" | "unjustified" | null;
export interface AccessEntry {
  id: string; at: string; who: string; whoAppId?: string; provider: string | null; what: string;
  purpose: string; purposeLabel: string; outcome: Outcome; emergency: boolean; review: Review;
}

export interface DayCount { date: string; count: number; blocked: number }
/** Active consents given to one place. */
export interface Place { who: string; whoAppId?: string; consents: Consent[] }

export interface Overview {
  activeConsents: number; parties: number; accessLast30Days: number; pendingEmergency: number;
  lastAccess: AccessEntry | null; expiringSoon: Consent[]; places: Place[]; daily: DayCount[]; recent: AccessEntry[]; lines: string[];
}

export interface Profile { contactName: string; contactPhone: string; bloodType: string; note: string; updatedAt: string | null; patientCode: string | null }
export type ProfileInput = Pick<Profile, "contactName" | "contactPhone" | "bloodType" | "note">;
