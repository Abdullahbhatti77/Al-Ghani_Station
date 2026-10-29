# Local development

## Prerequisites
- [Bun](https://bun.sh). The repo uses `bun.lock`.
- Git.
- A Supabase project. The hosted project for this app is managed by Lovable Cloud. For your own copy, create a Supabase project and apply the migrations.

## 1. Clone and install
```bash
git clone <your-repo-url> pumphisab
cd pumphisab
bun install
```

## 2. Environment
```bash
cp .env.example .env
```
Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID`. Optionally also set the matching `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` for server-side rendering. See [.env.example](../.env.example). Never commit `.env`.

## 3. Database
Apply the SQL files in `drizzle/migrations/` in order (`0000` → `0007`) to an empty Supabase database. One way is with `psql`:
```bash
for f in drizzle/migrations/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```
`DATABASE_URL` here is only your own Postgres connection string for this command. The app does not read it. Then, in Supabase Auth, enable email/password sign-in and set the site URL to `http://localhost:8080`.

## 4. Run
```bash
bun run dev        # Vite dev server
```

## 5. Build, lint, test
```bash
bun run build      # production build
bun run lint       # eslint
bun run test       # vitest run (unit tests)
bun run format     # prettier --write
```

## Notes
- Do not edit generated files: `src/routeTree.gen.ts` and `src/integrations/supabase/*`.
- If the schema changes, regenerate `src/integrations/supabase/types.ts`, either with `supabase gen types typescript` or through Lovable.
