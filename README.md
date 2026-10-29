# PumpHisab

**Petrol station accounts for Pakistani pump owners, in English and Roman Urdu.**

PumpHisab replaces the paper register at a petrol pump. Owners and staff record nozzle meter readings, close shifts, track fuel stock and deliveries, keep customer credit (*udhaar*), supplier balances and expenses, and read reports. All figures come from saved records.

> Status: MVP under active development. Nothing has been verified as production-ready. See [Implementation status](#implementation-status).

## Contents
- [Problem and goals](#problem-and-goals)
- [Main features](#main-features)
- [Roles](#roles)
- [Technology stack](#technology-stack)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Documentation](#documentation)
- [Implementation status](#implementation-status)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)

## Problem and goals
Many pumps track meter readings, cash, udhaar and stock by hand. Mistakes and missing cash are hard to trace. PumpHisab aims to:
- calculate litres and sales from meter readings using the fuel price that was in effect at the time,
- show any shortfall or excess at shift close, without hiding it,
- keep one auditable ledger each for stock, udhaar and supplier balances,
- never show demo numbers as real ones,
- stay simple enough for an attendant on a phone, in Roman Urdu.

## Main features
| Module | What it does |
|---|---|
| Station setup | Six steps: fuel products, tanks, nozzles, price history, suppliers, review |
| Shifts | Five-step wizard: start, readings, review sales, reconcile, close. Drafts are resumable, closed shifts can be corrected with an audit trail |
| Fuel stock | Ledger-based expected stock, deliveries (with reversal), physical dips, adjustment requests with approval |
| Udhaar | Customers, credit sales, repayments, credit limits, running ledger |
| Suppliers | Payables derived from deliveries, minus payments |
| Expenses | Categories, drawer or bank expenses, reversals |
| Reports | 10 reports with date presets, CSV export and print |
| History | Audit log written on the server side |
| Settings | Station profile, language, dip threshold, expense categories, staff, account |

Details: [docs/FEATURES.md](docs/FEATURES.md).

## Roles
| Role | Can do |
|---|---|
| Owner | Everything, including station settings, prices and staff |
| Manager | Operations, approvals, reversals, reports, history |
| Staff (attendant) | Only their own shifts and the entries linked to those shifts |

## Technology stack
TanStack Start v1 (React 19, Vite 7, TanStack Router and Query), TypeScript, Tailwind CSS v4 and shadcn/ui, Supabase (Postgres, Auth, RLS, RPCs) through Lovable Cloud, Drizzle-managed SQL migrations, Vitest, Bun.

## Screenshots
_Screenshots have not been added yet._ Suggested files: `docs/screenshots/dashboard.png`, `shift-wizard.png`, `fuel-stock.png`, `reports.png`.

## Quick start
```bash
git clone <your-repo-url> pumphisab && cd pumphisab
bun install
cp .env.example .env   # then fill in your project values
bun run dev
```
Full guide: [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md).

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Features](docs/FEATURES.md)
- [Database](docs/DATABASE.md)
- [Business logic](docs/BUSINESS-LOGIC.md)
- [Local development](docs/LOCAL-DEVELOPMENT.md)
- [Security](docs/SECURITY.md)
- [Internationalisation](docs/I18N.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

## Implementation status
**Implemented:** every module in the table above. There are 50 Vitest unit tests for the calculation, permission and translation logic.

**Partially verified:** a scripted API run covering a full station workflow (roles, isolation, idempotency) passed during development. That script is not part of the repository. Password reset email and multi-nozzle and meter-rollover shifts have not been tested end-to-end in a browser.

**Not implemented:** see below.

## Known limitations
- No automated end-to-end or database (RLS) test suite in the repo.
- Staff can be added only if they already have a PumpHisab account. There are no email invitations.
- One station per user is assumed by the app shell.
- No offline mode, SMS/WhatsApp notifications, or printed receipts.
- Lubricants and other non-fuel products are not sold or stocked.
- **Proposed, not built:** pump/ATG hardware integration, OGRA/FBR or tax integrations, multi-station consolidated reports, data export or backup tooling inside the app.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md). Project rules for structural decisions are in [AGENTS.md](AGENTS.md).
