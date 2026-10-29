# PumpHisab documentation set

Documentation only. No app behaviour changes.

## Step 1 — Inspect the real project
Read package.json and bun.lock, the routes, components, `src/lib/*` (shifts, inventory, finance, reports, permissions, i18n), the migrations in `drizzle/migrations`, Supabase config and env usage (`import.meta.env.*`, `process.env.*`), and the tests. Every claim in the docs comes from this reading.

## Step 2 — Write the files
- `README.md`: rewrite it as an overview with a table of contents, features, roles, tech stack, screenshot placeholders, quick start, status, limitations and links to the docs.
- `docs/ARCHITECTURE.md`: routing, layouts, data access (TanStack Query plus Supabase client and RPCs), auth, roles and RLS. Includes a Mermaid architecture diagram and a request-flow sequence diagram.
- `docs/FEATURES.md`: each module (Setup, Shifts, Fuel Stock, Udhaar, Suppliers, Expenses, Reports, History, Settings, Staff), with each feature marked implemented, partial or planned.
- `docs/DATABASE.md`: all 23 tables, their keys, constraints, triggers, RPCs and RLS, the migration list and a Mermaid ER diagram.
- `docs/BUSINESS-LOGIC.md`: formulas with labelled examples (litres sold, rollover, price snapshot, sales/collection variance, drawer cash, expected stock, dip variance, udhaar, payables), plus rounding, idempotency, reversals and gaps.
- `docs/LOCAL-DEVELOPMENT.md`: bun commands taken from the scripts, env setup, applying migrations, tests and lint.
- `.env.example`: only the VITE_SUPABASE_* variables the app actually uses, with public/server-only notes and no secrets.
- `docs/SECURITY.md`, `docs/I18N.md`, `docs/TESTING.md` (existing Vitest suites plus a manual checklist; recommended tests are marked as not yet written), `docs/DEPLOYMENT.md` (Cloudflare Worker/edge build, migrations, backups, post-deploy checks; no claim that it is deployed).
- `CONTRIBUTING.md`, `CHANGELOG.md` (one Unreleased section only).

## Step 3 — Validate
Script-check that every relative link and every referenced path, script, table and env var exists. Scan for secrets. Check Mermaid syntax with mermaid-cli if it is available. Fix anything found, then list the files and the known gaps (for example: no automated E2E or RLS tests, and password reset not verified end-to-end).
