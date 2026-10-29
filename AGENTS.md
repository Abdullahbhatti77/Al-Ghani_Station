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
- Setup records (products, tanks, nozzles, suppliers) are archived via `is_active`, never deleted — history must stay reportable.
- `fuel_prices` is insert-only; current price = latest `effective_at <= now` (`currentPrice` in `src/lib/setup.ts`) — past prices and sales never change.
- Nozzle/tank product match is enforced by DB trigger `check_nozzle_tank` as well as the UI.
- Shift data (shifts, shift_readings, shift_corrections) is read-only to clients; all writes go through security-definer RPCs (start_shift, save_shift_draft, close_shift, correct_*) that recompute litres/amount server-side with the same formula as `src/lib/shifts.ts` — prevents tampering and double posting.

- Expected tank stock = sum of `stock_movements` (unique per kind+source_id); movements are posted only by security-definer RPCs/triggers (tank insert, record/reverse_delivery, close_shift, correct_closed_reading, approved review_stock_adjustment). Dips never change stock; `tanks.opening_stock_litres` is creation-time only — keeps one auditable source of truth.
