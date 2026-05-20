That was incredibly fast! "FairShare" is a brilliant choice—the double meaning hits perfectly, and pivoting it now while the codebase is fresh is the smartest move.

Here is a clear, actionable "Change Document" you can hand directly to your coding agent to execute the rebrand across the existing codebase.

---

### Feature Request: Project Rebrand to "FairShare"

**1. Objective**
We are pivoting the application's domain from a specific "flatmate/housing" expense tracker to a generic, universal expense-sharing application suitable for any temporary group (e.g., holidays, DIY projects, event planning). The core math, privacy, and token logic remain exactly the same, but the semantic terminology and branding must be updated across the entire stack.

**2. Global Terminology Mapping**
Please execute a comprehensive find-and-replace (both in UI copy and underlying code/variables) according to the following dictionary:

* **Project Name:** "Flatmate Mate" ➔ **"FairShare"**
* **Entity:** "House" / "Household" ➔ **"Group"**
* **Entity:** "Flatmate" ➔ **"Member"**
* **Role:** "Keyholder" ➔ **"Organizer"**
* **Dates:** "Tenancy / Move-in & Move-out" ➔ **"Active Period / Join & Leave dates"**

**3. Required Codebase Updates (Based on v0.1.0)**

* **UI/Frontend (`index.html`, `index.css`, `app.js`):**
* Update all headers, titles, modal text, button labels, and empty-state messages to reflect the new generic "Group/Member" terminology.
* Ensure the "Setup Household" view is rebranded to "Create a Group".


* **Backend API (`/api/`):**
* Rename the `api/flatmates.js` file to `api/members.js` (and update routing in `server.js` accordingly).
* Refactor variable names and JSON keys (e.g., `houseId` to `groupId`, `flatmateId` to `memberId`, `keyholderId` to `organizerId`).


* **Database / Storage (`db.js`, `database.json`):**
* Migrate the mock/local database schema to use the new nomenclature.


* **Tests (`test-api.js`):**
* Update all test descriptions and mock data logic to reflect the new terminology.



**4. Definition of Done (DoD)**

* [ ] The UI contains zero references to "flatmates", "houses", or "tenancy".
* [ ] The application successfully runs the integration test suite under the new terminology.
* [ ] `CHANGELOG.md` is updated with version `v0.2.0` outlining the semantic rebrand to "FairShare".