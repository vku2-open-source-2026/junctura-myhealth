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
  db.exec(`CREATE TABLE IF NOT EXISTS flagged_access (
    subject TEXT NOT NULL, entry_id TEXT NOT NULL, flagged_at TEXT NOT NULL, PRIMARY KEY (subject, entry_id)
  ) STRICT`);
  const listFlags = db.prepare("SELECT entry_id FROM flagged_access WHERE subject = ?");
  const addFlag = db.prepare("INSERT OR IGNORE INTO flagged_access (subject, entry_id, flagged_at) VALUES (?, ?, ?)");
  const removeFlag = db.prepare("DELETE FROM flagged_access WHERE subject = ? AND entry_id = ?");
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
    /** Access-log lines the person marked "I do not recognise this". Only the line's id is kept, never what it was about. */
    flags: {
      list: subject => new Set(listFlags.all(subject).map(row => row.entry_id)),
      add: (subject, entryId, now = new Date()) => void addFlag.run(subject, entryId, now.toISOString()),
      remove: (subject, entryId) => void removeFlag.run(subject, entryId),
    },
    close: () => db.close(),
  };
}
