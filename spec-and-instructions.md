# Coding Agent Instructions

## 1. Professional Persona

* **Role:** Senior Frontend Architect. You favor robust, modular, and DRY (Don't Repeat Yourself) code.
* **Focus:** Privacy-first, performant, local-web architecture.

## 2. Versioning & Change Management

* **Changelog:** After every feature completion, update `CHANGELOG.md` with version (v0.x.x), date, and changes.
* **Headers:** Every modified file must have a "Last Modified" comment at the top.

## 3. Implementation Workflow (Plan-First)

* **The 'Think' Phase:** Before writing code, provide a "Plan of Action" for user approval.
* **Verification:** Explain how you verified the code against the Technical Guardrails

## 4. Quality Guardrails

* **No Shortcuts:** Never use hard-coded pixel offsets for centering. Use Flex/Grid.
* **Modularity:** Separate DOM manipulation from business logic.
* **Cleanup:** Ensure all event listeners are named functions for proper cleanup.

## 5. Definition of Done (DoD)

*Before declaring a task finished, verify:*

1. [ ] No placeholder comments (e.g., `// logic here`) remain.
2. [ ] All new functions are documented with JSDoc.
3. [ ] `CHANGELOG.md` is updated.
4. [ ] The UI remains responsive and functional down to 320px width.

# Environment & Tech Stack

## 1. The Tech Stack

* **Core:** HTML5, CSS3 (Modern features only, CSS Variables/Grid/Flexbox), and Vanilla JavaScript (ES6+ Modules).
* **Hosting & Security:** Netlify or Vercel. We will use their free Serverless Edge Functions to securely hold the RestDB API keys and handle data requests, keeping all secrets completely out of the browser.

## 2. Persistence Layer

* **Primary Storage:** RestDB.
* **Data Format:** Strict JSON.
* **Backup:** Must include a simple 'Export to CSV' or 'Export to PDF' feature for personal record-keeping.

## 3. Data Communication Contract

* **Protocol:** The frontend will communicate exclusively with our own Serverless Functions via the native `Fetch` API. Those functions will authenticate and securely pass the data to/from RestDB.

## 4. Library White-list

* **Dates:** `Day.js` (Lightweight, robust i18n for enforcing strict UK `DD/MM/YYYY` formatting).
* **Currency & Numbers:** Strictly native JavaScript `Intl.NumberFormat` API (Zero extra weight, handles UK locale and GBP currency perfectly).

# Flatmate Mate - Project Instance

## 1. Project Summary

* **Name:** Flatmate Mate
* **Description:** A lightweight, zero-friction web application for shared households to track, split, and manage shared utility bills and expenses via secure, unique URL tokens.
* **Key Features:** * **Zero-Login Access:** Secure room-code URL routing for immediate access.
* **Strict "Need-to-Know" Privacy:** Users only see balances and bill details that directly involve them. Third-party debts and uneven split ratios are completely hidden.
* **Smart Tenancy Tracking:** Bills are bound to specific date-scopes, automatically filtering which flatmates are eligible to contribute based on their move-in and move-out dates.
* **Instant Balance Dashboard:** At-a-glance summaries of net debts between the active user and their flatmates.



## 2. Feature Modules

* **Module A: Auth & Routing Engine:** Parses the URL token, identifies the current user, determines if they are the Keyholder, and protects routes.
* **Module B: House Settings (Keyholder Only):** A gated interface for the Keyholder to manage flatmate tenancies (move-in/out dates) and revoke access tokens.
* **Module C: Dashboard & Math Controller:** Calculates net balances (who owes whom) across active bills, rigorously filtering data so the UI *only* processes math relevant to the active user's token.
* **Module D: Bill Management Module:** Handles CRUD operations. Features date-scoped logic to only allow selecting flatmates who lived in the house during the bill's "Applicable Period." Enforces rules where only the original payer can log a payment.

## 3. User Stories

* **Story 1 (Setup & Admin):** As a **Keyholder**, I want exclusive access to a Settings menu to add flatmates, set tenancy dates, and revoke URL tokens, so the household remains secure.
* **Story 2 (Strict Privacy):** As a Flatmate, I want the dashboard and bill lists to only display debts I owe or are owed to me, so my financial privacy (and others') is maintained.
* **Story 3 (Adding Bills):** As a Flatmate, I want to log a new bill with an "Applicable Period" (Start/End Date), so the system only lets me split the cost with people who actually lived there during that time.
* **Story 4 (Authoritative Payments):** As a Flatmate who fronted the money, I want to be the *only* person authorized to mark another flatmate's share as "paid", ensuring the financial record is accurate.
* **Story 5 (Viewing Bills):** As a Flatmate, I want to see a grid categorized by "Bills I owe" and "Bills owed to me," displaying only my specific financial share of those bills.
* **Story 6 (Future-Proofing V1.5):** As a Flatmate, I want the underlying system to support uneven bill splits behind the scenes, so that future updates can allow precise billing without exposing exactly what others are paying.
* **Story 7 (Exporting):** As a Flatmate, I want to export my balances to a CSV/PDF file, so that I can keep a hard copy of my settled debts.

## 4. UI/UX Design

* **Theme & Styling:** Clean, modern, and uncluttered. High contrast for readability. UK Localization enforced (dates strictly `DD/MM/YYYY`, GBP default).
* **Page Layout:** A primary top-level Tab navigation (Dashboard | My Bills). A "Settings" gear icon is only rendered in the header if the active token belongs to the Keyholder.
* **Component Specifics:** * Data grids heavily filtered by the active user's ID.
* Modal overlays for "Add a Bill" and "Bill Details" to keep the user on the main context screen.
* "Add Bill" modal includes a date-range picker for the "Applicable Period," dynamically graying out checkboxes for flatmates who moved out before, or moved in after, that period.
* Clear visual status badges (e.g., Red for Unpaid, Green for Paid).



## 5. Technical Specifics & Guardrails

* **Financial Math Integrity:** All currency must be calculated using integer math (e.g., converting £10.50 to 1050 pence for calculations) to avoid floating-point errors in JavaScript.
* **Date Integrity:** Dates must be strictly saved to the database as ISO 8601 strings. UI parsing handled via `Day.js`.
* **Server-Side Privacy Enforcement:** The Serverless Edge Function must intercept the database response and strip out all `BillSplit` records that do not contain the active user's ID *before* sending the payload to the browser.
* **The "Extra Penny" Rule:** When a bill doesn't split evenly, the logic ensures the total remains exact (e.g., two people pay £3.33, the payer covers £3.34).

## 6. Boundary Conditions & Edge Cases

* **Empty States:** The dashboard and grids must display helpful "No bills logged yet!" or "You're all settled up!" messages when arrays are empty.
* **Over-payments/Partial Payments:** For version 1, restrict payments to binary states: "Unpaid" or "Fully Paid."
* **Ex-Flatmates (Soft Delete):** A flatmate with a past `moveOutDate` remains in the system so historical debts don't break, but they will no longer appear as an option for new bills.
* **Revoked Access:** The Keyholder can set `isTokenActive` to false for an ex-flatmate. If that token is used, the system renders a "Link Expired" view.

## 7. Project-Specific Logic or Data Structures

* **House Collection:** `{ houseId, name, keyholderId }`
* **Flatmate Collection:** `{ flatmateId, houseId, name, secureToken, moveInDate, moveOutDate, isTokenActive }`
* **Bill Collection:** * `billId`, `houseId`, `payerId`
* `purpose`, `totalAmount`
* `applicablePeriodStart`, `applicablePeriodEnd`
* `dateLogged`, `dateDue`


* **BillSplit Collection:** * `splitId`, `billId`, `flatmateId`
* `amountOwed`, `isPaid`, `datePaid`