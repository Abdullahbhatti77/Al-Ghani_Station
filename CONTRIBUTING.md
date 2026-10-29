# Contributing to PumpHisab

Thanks for helping! Please read [AGENTS.md](AGENTS.md) (project rules) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.

## Prerequisites
Bun, Git and a Supabase project. Setup is in [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md).

## Branches and commits
- Branch names: `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
- Commits follow Conventional Commits, for example `feat(shifts): add rollover hint` or `fix(reports): exclude reversed expenses`.
- Do not force-push or rewrite history that has already been pushed. The repo syncs with Lovable.

## Coding standards
- TypeScript strict. Use the generated `Database` types and avoid `any`.
- Data access goes through `queryOptions` factories in `src/lib/*`. Pages use loaders and `useSuspenseQuery`.
- Put calculations in pure functions with unit tests.
- Styling uses Tailwind semantic tokens from `src/styles.css`. No hardcoded colours.
- Run `bun run lint` and `bun run test` before opening a PR.

## Adding a feature
1. Add the schema and RPCs in a new numbered migration. Never edit applied migrations.
2. Regenerate the Supabase types.
3. Add query helpers and pure logic in `src/lib/`, with tests.
4. Add a route under `src/routes/_authenticated/_app/`.
5. Add translations in English and Roman Urdu.
6. Gate the UI with `can()`. The backend must enforce the same rule.

## Changing the database safely
- Every new table needs `station_id`, GRANTs, RLS enabled and policies based on `is_station_member` / `has_station_role`.
- Financial and operational writes go through security-definer RPCs with `client_key` idempotency. Use reversals, never deletes.
- Prefer additive changes (new nullable columns) over drops and renames.

## Translations
Every visible string is a key in both `*.en.ts` and `*.ur.ts`. Roman Urdu uses Latin script only. See [docs/I18N.md](docs/I18N.md).

## Pull requests
Explain what changed and why, add screenshots for UI changes, list the manual checks you ran from [docs/TESTING.md](docs/TESTING.md), and mention any migration.
