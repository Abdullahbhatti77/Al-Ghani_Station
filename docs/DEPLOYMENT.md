# Deployment

The app has **not** been published, and it is not yet certified as production-ready.

## Recommended: Lovable publishing
The project is connected to Lovable and Lovable Cloud. Publishing from Lovable builds the TanStack Start app for its edge (Cloudflare Worker-style) runtime, serves it over HTTPS and uses the same Cloud backend. Environment values are injected automatically. You can add a custom domain in the project settings.

## Self-hosting (alternative)
1. Create a Supabase project and apply `drizzle/migrations/0000`–`0007` in order (see [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md)).
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (build time) and `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (runtime).
3. Run `bun install && bun run build`.
4. Deploy the build output to a host that supports TanStack Start's edge/Worker target, such as Cloudflare. Check the build output and the TanStack Start hosting docs for the exact adapter config, which is not documented in this repo.
5. Serve over HTTPS only.
6. In Supabase Auth, set the site URL and redirect URLs (for `/reset-password`) to your domain, and configure SMTP for confirmation emails.

## Backups
Turn on Supabase scheduled backups or point-in-time recovery. Test a restore before you rely on it. The app has no export tool of its own beyond report CSVs.

## Post-deployment verification
- [ ] Sign-up email arrives and the link opens the production domain.
- [ ] Create a station and complete setup.
- [ ] Run one shift end-to-end and check the reports.
- [ ] Run the role and isolation checks in [TESTING.md](TESTING.md) with real accounts.
- [ ] Run the Supabase security linter. See [SECURITY.md](SECURITY.md).
