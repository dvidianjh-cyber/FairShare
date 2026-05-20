### Feature Request: Group Configuration Toggles (Frictionless Mode)

**1. Objective**
Introduce group-level settings during the "Create a Group" flow. These toggles will allow the Organizer to disable certain mandatory fields (like date ranges and specific member selection) to streamline the "Add Expense" UX for casual use cases (e.g., a night out, where everything is split equally among everyone, instantly).

**2. The New Toggles (UI Terminology)**
Please add the following configuration toggles to the "Create a Group" setup form. (They should default to **ON** to preserve the existing v0.2.0 logic):

* **"Track Expense Date Ranges"**: (Underlying variable: `requireDates`)
* *Description for UI:* "Require start/end dates for bills to track who should contribute."
* *Off State:* "Simple Mode: No dates required (great for holidays or nights out)."


* **"Require Member Selection per Expense"**: (Underlying variable: `requireMemberSelection`)
* *Description for UI:* "Manually select which members contribute to each expense."
* *Off State:* "All-In Mode: Automatically split every expense evenly across all active members."

*Note: Please leave a commented-out placeholder in the code for a future toggle: `// TODO (v0.4^.0): allowUnevenSplits`. This is an EXCEPTION to the agent instructions not to leave placeholders in the code.*

**3. Required Codebase Updates**

* **Database / Storage (`db.js`, `database.json`):**
* Update the `Group` schema to include a `config` object: `{ requireDates: boolean, requireMemberSelection: boolean }`.


* **Backend API (`/api/setup.js`, `/api/auth.js`, `/api/bills.js`):**
* **`setup.js`:** Parse and save the new `config` object from the setup request.
* **`auth.js`:** Ensure the `Group.config` object is returned to the client upon successful authentication so the UI knows how to behave.
* **`bills.js` (POST):** * If `requireDates` is false, bypass the tenancy-overlap date validation and set the bill's `applicablePeriod` to `null`.
* If `requireMemberSelection` is false, ignore the provided flatmate array and automatically generate splits for *all* currently active members in the group.


* **Frontend UI (`index.html`, `app.js`):**
* **Setup View:** Add the two UI toggle switches to the group creation form.
* **"Add Expense" Modal:** * Read the group's config state.
* If `requireDates` is `false`, completely hide the Date Range picker UI.
* If `requireMemberSelection` is `false`, completely hide the member checklist checkboxes. Render a disabled label saying: *"Splitting evenly across all active members."*


**4. Definition of Done (DoD)**

1. [ ] The "Create Group" screen includes the two new toggles.
2. [ ] The "Add Expense" modal dynamically adapts its UI (hiding fields) based on the group's configuration.
3. [ ] The backend API safely handles bill creation even when dates and specific member arrays are omitted (based on the config flags).
4. [ ] `CHANGELOG.md` is updated with version `v0.3.0` outlining the new "Group Configuration Toggles".