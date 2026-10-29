# Security

## Authentication
Supabase Auth email/password with email confirmation. There is no anonymous sign-in. A `handle_new_user` trigger creates the profile.

## Roles and station isolation
Roles live in `station_members` (enum `station_role`: owner, manager, staff), never on profiles.
- `is_station_member` and `has_station_role` (security definer) are used in every RLS policy.
- **owner:** station settings, prices, staff, plus everything a manager can do.
- **manager:** setup records, deliveries, supplier payments, approvals, reversals, corrections, reports, history.
- **staff (attendant):** reads station data. Writes are limited to shifts where they are the attendant, enforced by the `guard_staff_writes` trigger.

The UI matrix in `src/lib/permissions.ts` only hides controls. The database is the real enforcement.

## Write paths
Transactional tables have no client INSERT, UPDATE or DELETE. Security-definer RPCs check membership and role, validate input, recompute values and return error codes such as `forbidden` or `attendant_own_shift_only`. Membership changes go only through RPCs, and the last owner cannot be removed or demoted.

## Audit
`audit_log` is written by `audit_trigger` and the staff RPCs. Clients can only read it, and only as owner or manager. Direct inserts are blocked by RLS.

## Validation
Zod schemas in the UI. CHECK constraints, triggers (`check_nozzle_tank`, `guard_tank_update`, opening-balance guards) and RPC checks in the database.

## Secrets
Only the publishable key and URL are shipped to the browser. The service-role key and database password are never in the repo or the client. `.env` is not listed in `.gitignore`. The Lovable-managed `.env` holds only public values, but if you fork the project, add `.env` to `.gitignore` before adding any secrets.

## Verified during development
A scripted API run (not in the repo) confirmed the following were blocked: cross-station reads and writes, signed-out reads, price changes by non-owners, attendant deliveries/approvals/reversals/self-promotion, direct edits to closed shifts and audit writes.

## Known limitations
- No automated RLS regression suite.
- No rate limiting beyond Supabase defaults.
- No 2FA.
- Password reset is not tested end-to-end.
- Backups depend on the hosting provider. The app has no export or restore tool.

## Pre-deployment checklist
- [ ] Run the Supabase security advisor/linter and resolve any findings.
- [ ] Confirm RLS is enabled on every public table.
- [ ] Test with real owner, manager and staff accounts on two stations.
- [ ] Set the Auth site URL and redirect URLs to the production domain.
- [ ] Turn on point-in-time recovery or scheduled backups.
- [ ] Make sure no `.env` or keys are committed (`git log -p | grep -i key`).
