<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All visible UI text goes through `useT()` keys in `src/lib/i18n/en.ts` + `ur.ts` (typed parity; test in `src/lib/i18n/i18n.test.ts`) — no hardcoded strings.
- Every business table has `station_id` and RLS via `public.is_station_member` / `public.has_station_role` — station-level isolation.
- Station + owner membership is created only through the `create_station_with_owner` security-definer RPC — clients can never insert memberships.
- Signed-in pages live under `src/routes/_authenticated/_app/` (sidebar layout, redirects to `/onboarding` when the user has no station) — single gate for station context.
- Dashboard figures are `null` until real records exist; never render demo numbers as real — owners must trust the numbers.
