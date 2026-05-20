# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-05-20

### Added
- Group setup configuration options (`requireDates`, `requireMemberSelection`) supporting casual and frictionless environments (e.g., weekend getaways, holiday trips).
- UI toggles to onboarding setup form with interactive, descriptive feedback.
- Dynamic adaptation of the "Add Bill" modal to automatically hide dates and manual member checklists when disabled by the group's setup settings.
- Backend support in `/api/bills.js` for date-free bills and automatic billing split propagation across all active members.
- Robust integration test cases (Test 12 and 13) to verify frictionless and selective date-free billing.
- Enabled secure token persistence in the browser's address bar to support frictionless bookmarking and session recovery.

## [0.2.0] - 2026-05-20

### Changed
- Rebranded entire application from "Flatmate Mate" to "FairShare" to shift focus from housing to general group expense sharing.
- Updated database collections in `database.json`: `houses` -> `groups`, `flatmates` -> `members`.
- Refactored `api/db.js` API wrapper with renamed helpers (`getGroup`, `getMembers`, `createMember`, etc.) and field variables (`groupId`, `memberId`, `organizerId`).
- Renamed and migrated `/api/flatmates.js` to `/api/members.js`.
- Refactored `/api/setup` to instantiate Organizer role and create Group collections.
- Refactored `/api/auth` and `/api/auth-helper.js` using Group and Member terminology.
- Refactored `/api/bills` and `/api/splits` to validate active periods (`joinDate`/`leaveDate`) and member IDs.
- Rebranded client UI in `index.html` and selectors in `index.css`.
- Renamed and updated frontend JS modules `app.js` and `api-client.js` with zero traces of housing-centric terms.
- Updated CSV exporting engine `export.js` and integration test suite `scratch/test-api.js` to assert rebranded behaviors.

## [0.1.0] - 2026-05-20

### Added
- Setup project infrastructure including `package.json` and `.gitignore`.
- Local lightweight Node.js development server `server.js` matching Vercel Serverless Function specifications.
- Unified database adapter layer `api/db.js` with direct support for RestDB in production and local `database.json` file fallback in development.
- Secure, token-based authentication API `/api/auth` and helper `/api/auth-helper.js` implementing flatmate access token stripping for privacy.
- Setup household initialization API `/api/setup`.
- Gated flatmate manager API `/api/flatmates` allowing Keyholder-only tenant additions, date updates, and token revocations.
- Bill management API `/api/bills` supporting:
  - Tenancy period date overlap checks.
  - "Extra Penny" rule for rounding remainders to the payer's split.
  - Server-side privacy filters stripping out third-party split details.
- Split payment API `/api/splits` verifying that only original bill payers can toggle payment status.
- Single-page application user interface in `index.html` and premium dark theme stylesheet `index.css`.
- Client-side application script `app.js` managing UI tabs, modals, date picker change listeners, dynamic checklists, and GBP localization.
- API fetch abstraction client `api-client.js`.
- Balance export statement to downloadable CSV in `export.js`.
- Extensive backend integration test suite in `scratch/test-api.js`.
