// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PATIENT_ROLE = "patient";

const readJson = (healthDir, name) => JSON.parse(readFileSync(resolve(healthDir, "seed/data", name), "utf8"));

/**
 * The people who may sign in to MyHealth: the demo accounts of this app (role "patient") from a
 * junctura-health checkout, each with the patient code printed on Clinic's records so a clinic can
 * find them. Nothing else of the clinical record is read here; MyHealth never holds it.
 */
export function loadPatients(healthDir) {
  const accounts = readJson(healthDir, "accounts.json").users.filter(user => user.app === "junctura-myhealth" && user.role === PATIENT_ROLE);
  const codes = new Map(readJson(healthDir, "clinic.json").patients.map(patient => [patient.subject, patient.patientId]));
  return new Map(accounts.map(user => [user.username, Object.freeze({
    username: user.username, subject: user.subject, displayName: user.displayName, role: user.role, patientCode: codes.get(user.subject) ?? null,
  })]));
}
