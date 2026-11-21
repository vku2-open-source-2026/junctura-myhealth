<!-- SPDX-FileCopyrightText: 2026 Junctura Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Changelog

All notable changes to Junctura MyHealth are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- **This month in plain sentences** on the Overview: looks and places this calendar month (Vietnam time), the place
  that looked most, comparison with last month, blocked and emergency looks, consents given and revoked. Composed by
  fixed rules from the access log (no model) and never says what was read. `/api/overview` returns it as `month`.
- **Download the access log** as a CSV file (Who has looked): exactly the rows on screen, Vietnam time, with a byte
  order mark for Excel, spreadsheet formulas defused. It holds who, when, kind of data, purpose and outcome, never the
  content that was read.

### Changed

- Redesigned the interface: Overview shows places allowed, a 14-day activity chart with a text alternative and the
  latest looks; Consents groups by place and suggests places not yet allowed; Who has looked is grouped by day with a
  stat strip; Emergency explains the three steps. `/api/overview` now also returns `places`, `daily` and `recent`.

## 0.1.0 - 2026-11-20

### Added

- **Sign-in** with a Junctura account (OpenID Connect, PKCE). Only accounts with the `patient` role of this
  application get in; staff accounts and unknown roles are refused with 403.
- **Consent** screen: grant a place access to one kind of data for stated purposes and a chosen duration
  (30 days to 1 year), see what is allowed and the history, revoke with confirmation. Backed by Junctura's
  `/v1/me/consents`; MyHealth forwards the patient's own token, so a patient can only ever see and change their own.
- **Who has looked**: the access log from `/v1/me/data-access`, filtered by period and by place, with blocked
  attempts shown as blocked.
- **Emergency**: break-glass accesses to the patient's data with their review state.
- **Overview**: counts and plain sentences (places allowed, looks in the last 30 days, emergencies waiting for
  review, consents about to expire), composed by fixed rules.
- **My information**: self-declared emergency contact, blood type and a note (SQLite), and the patient code as a QR
  for a clinic to find the right record.
- Phone-first interface on `@junctura/health-ui` (large text by default, bottom navigation, light and dark).
- Server and web tests, `npm run check` and `npm run check:reuse`, GitHub Actions, Dockerfile and `compose.yaml`,
  release workflow that publishes `junctura-myhealth-X.Y.Z.tar.gz`.
- Project policies: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `THIRD-PARTY.md`.
