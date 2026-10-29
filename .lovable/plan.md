# PumpHisab — Station Setup module

## What you get
A guided **Station Setup** wizard (new menu item + linked from the dashboard checklist) with 5 steps, a progress bar, plain-language help and examples in English and Roman Urdu, and a final **Review** screen. Any step can be reopened and edited later.

1. **Fuel products** — add/edit/archive products (e.g. Petrol (MS), Diesel (HSD), lubricants). Name, short code, unit (litre / kg / piece), active. Renaming is safe: records link to the product, not its name.
2. **Storage tanks** — name/number, product, capacity (L), opening stock (L, "measured with dip"), low-stock alert level. Stock can never go below 0 or above capacity; editing opening stock once set requires a confirmed "correction" with a reason (owner/manager only), saved in a history log.
3. **Nozzles** — number, display name, product, supplying tank, current meter reading, active. The tank list only shows tanks of the same product, and the database refuses mismatches too.
4. **Fuel prices** — per product, PKR per litre, effective date/time, who saved it and when. A confirmation dialog repeats the rate and date before saving. Past prices are never edited or deleted; a price history table shows all rates. No built-in or fetched prices.
5. **Suppliers** — business name, contact person, phone, address, opening payable balance, notes; archive instead of delete.

Every list is searchable, has Add/Edit dialogs, friendly validation messages, archive with confirmation, and empty states. Nothing is hard-deleted (archive only), so future reports stay intact.

**Dashboard**: the setup checklist becomes real — each step ticks when real records exist (products, tanks, nozzles, a price per active fuel product, suppliers), with a "Continue setup" button. Staff-step stays pending until staff invites exist.

**Demo data**: none added — keeps real records clean. (Can add clearly-labelled demo data later if wanted.)

## Permissions
- All station members can view setup data.
- Owners and managers can add/edit/archive and set prices; staff are read-only (forms hidden, database enforces it).

## Technical details
- Migration: tables `products`, `tanks`, `tank_stock_corrections`, `nozzles`, `fuel_prices`, `suppliers`, all with `station_id` FK, grants, RLS via `is_station_member` (select) and `has_station_role(owner, manager)` (write). No DELETE policies.
- Constraints: `opening_stock between 0 and capacity`, `capacity > 0`, `low_stock_threshold between 0 and capacity`, `price > 0`, unique (station_id, code) for products, unique tank name / nozzle number per station, `meter_reading >= 0`.
- Trigger on nozzles: tank must belong to same station and hold the same product; trigger on tanks/products/suppliers ensures cross-references stay in one station.
- `fuel_prices` is insert-only (no UPDATE/DELETE policies); `created_by` defaults to `auth.uid()` and is enforced by policy check. Current price = latest row with `effective_at <= now()`.
- Opening-stock changes after creation go through a `correct_tank_stock(tank_id, new_litres, reason)` security-definer RPC that checks role, bounds, and writes `tank_stock_corrections`; direct updates to stock are blocked by trigger.
- Routes: `_authenticated/_app/setup` (wizard with `?step=` search param) reusing PageHeader, DataTable, ConfirmDialog, FormField, EmptyState. Queries in `src/lib/setup.ts`.
- Translations: new keys in `en.ts` and `ur.ts` (parity test covers them).
- Tests: unit tests for zod rules (stock vs capacity, price > 0); Playwright: create/edit product, tank, nozzle, supplier, price; verify old price kept after a new one; try mismatched tank/nozzle (UI blocks, DB rejects); Roman Urdu switch; signed-out REST access returns nothing.
