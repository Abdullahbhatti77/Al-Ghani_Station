# Shift Management (Shift Band Karein)

Replace the Shifts placeholder page with a full guided shift flow. Existing modules, setup data and schema stay untouched; everything new is added alongside.

## What the user gets

**Shifts list (today by default)** — searchable by attendant / shift name, filter by date and status (Draft, Open, Closed). One large "Start Shift" button.

**Guided flow** — a 5-step progress bar: Start Shift → Enter Readings → Review Sales → Reconcile → Close Shift. Saved as a draft at every step, so closing the browser and returning resumes where you left off.

1. **Start Shift** — date, shift name (Morning / Evening / Night / custom), responsible attendant (station member), opening cash float. Every active nozzle is listed with its fuel and opening reading, prefilled from that nozzle's last closed reading (or its configured meter reading if it has never been used). A manager can correct a prefilled opening reading only with a written reason.
2. **Enter Readings** — large numeric fields per nozzle: closing reading and optional test/non-sale litres. Live litres sold = closing − opening − test litres. A closing reading lower than opening is highlighted red and blocks progress until a manager records a meter reset/rollover (with reason and the reading the meter rolled over at).
3. **Review Sales** — per nozzle litres and PKR, totals per fuel product, grand total, attendant. Price used is the price effective at the shift's start time, shown per row.
4. **Reconcile** — inputs for Cash, Bank transfer, Card, Mobile wallet (JazzCash/Easypaisa), Other, plus a disabled "Udhaar (credit) — coming soon" line. Shows Total Sales vs Money Collected side by side and the difference (Short / Excess / Matched). Nothing is auto-adjusted.
5. **Close Shift** — full summary, confirmation dialog, then a success screen with totals and "Start next shift".

**After closing** — the shift is read-only. Owners/managers can only make a logged correction (who, when, why, old/new value); no deletes, no reopening, no double posting.

## Rules
- Staff can start, fill and save their shifts; only owners/managers can correct readings, handle meter rollovers, and correct closed shifts.
- One open shift per nozzle at a time; a nozzle can't be in two active shifts.
- Closing a shift updates each nozzle's latest meter reading so the next shift opens from it.
- Tank stock is not deducted in this step (left for the Fuel Stock module).
- All text in English + Roman Urdu; PKR and litre formatting throughout.

## Technical details
- New tables (station-scoped RLS, grants, no deletes): `shifts` (status draft/closed, date, name, attendant, opening float, collection columns, totals, closed_by/at), `shift_readings` (nozzle, opening, opening_source, closing, test_litres, rollover_at, price snapshot, price_id, litres, amount), `shift_corrections` (audit log: field, old, new, reason, user, time).
- `close_shift(_shift_id)` security-definer RPC: re-validates readings, recomputes litres/amount server-side from `fuel_prices` (latest `effective_at <=` shift start), writes snapshots, sets status closed, updates `nozzles.meter_reading`, row-locks to prevent duplicate posting. Trigger blocks any update to closed shifts/readings except via `correct_shift_reading` RPC (owner/manager, logs correction, recomputes totals).
- Partial unique index stops a nozzle being in two draft shifts.
- Shared pure calc module `src/lib/shifts.ts` (litres, rollover, amount, reconciliation) used by UI; SQL mirrors the same formula. Vitest covers multiple nozzles, prefill, empty readings, test litres, historical rate selection, negative/rollover, reconciliation.
- Routes: `/shifts` list, `/shifts/$shiftId?step=` wizard. Playwright check of draft recovery, finalization, and duplicate-close rejection.
