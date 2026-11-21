// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * What a person writes about themselves (emergency contact, blood type, a note). It is the only
 * thing MyHealth stores, kept in a small local SQLite file under the person's Junctura subject.
 * Clinical records stay with the clinic and hospital; this is not one of them.
 */
export function openProfiles(file = ":memory:") {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS profile (
    subject TEXT PRIMARY KEY, contact_name TEXT, contact_phone TEXT, blood_type TEXT, note TEXT, updated_at TEXT NOT NULL
  ) STRICT`);
  const select = db.prepare("SELECT contact_name, contact_phone, blood_type, note, updated_at FROM profile WHERE subject = ?");
  const upsert = db.prepare(`INSERT INTO profile (subject, contact_name, contact_phone, blood_type, note, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(subject) DO UPDATE SET contact_name = excluded.contact_name, contact_phone = excluded.contact_phone,
      blood_type = excluded.blood_type, note = excluded.note, updated_at = excluded.updated_at`);
  const shape = row => (row
    ? { contactName: row.contact_name ?? "", contactPhone: row.contact_phone ?? "", bloodType: row.blood_type ?? "", note: row.note ?? "", updatedAt: row.updated_at }
    : { contactName: "", contactPhone: "", bloodType: "", note: "", updatedAt: null });
  return {
    get: subject => shape(select.get(subject)),
    save(subject, value, now = new Date()) {
      upsert.run(subject, value.contactName ?? null, value.contactPhone ?? null, value.bloodType ?? null, value.note ?? null, now.toISOString());
      return shape(select.get(subject));
    },
    close: () => db.close(),
  };
}
