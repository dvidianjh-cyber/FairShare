# FairShare

FairShare is a privacy-first, zero-friction web application designed for group expense tracking and bill splitting. Ideal for holidays, event planning, and shared projects, it allows group members to split utility and other shared bills dynamically according to their active dates during the bill's period.

## Key Features

- **Date-Scoped Active Periods**: Members are dynamically included in bill splits based on whether their group membership dates (Join Date to Leave Date) overlap with the bill's applicable period.
- **Privacy-First Design**:
  - Non-Organizer members can only see their own splits, keeping other members' financial arrangements private.
  - Only the group Organizer can see and copy other members' access tokens, add members, update active periods, or rename the group.
- **"Extra Penny" Rule**: When bill division yields a remainder (e.g. £10.01 split between 2 members), the remainder is absorbed by the payer to guarantee exact totals.
- **Zero-Friction Authentication**: Simple URL token parameters automatically establish safe sessions without requiring full password setup.
- **Data Portability**: Full CSV export of financial statements and balances for easy storage.
- **Deep Space Aesthetics**: Beautiful modern CSS theme using the Outfit font and glassmorphic designs.

## Getting Started

### Local Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
   or:
   ```bash
   node server.js
   ```
3. Open your browser and navigate to `http://localhost:3000`.

### Database Modes

FairShare supports dual-mode operation:
- **Local Database (Default)**: Persists state to a local `database.json` file.
- **RestDB API**: Toggle to production mode by configuring `RESTDB_URL` and `RESTDB_KEY` environment variables.

### Integration Tests

To run the integration suite verifying date-scoped eligibility, privacy rules, and payment toggling:
```bash
node scratch/test-api.js
```
