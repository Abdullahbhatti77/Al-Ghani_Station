# Fuel Inventory & Deliveries (Fuel ka Stock)

Replace the Fuel Stock placeholder with a working inventory module. Station Setup, Shifts and all existing data stay as they are.

## What the user gets

**Fuel Stock page** — one card per tank: fuel, expected litres (big number), capacity bar, last physical dip and when, difference vs expected, and warning badges. Filters: fuel product, tank, date range. Buttons: **Receive Fuel**, **Record Tank Dip**, **Stock Adjustment**. Tap a card for its detail.

**Tank detail** — the calculation spelled out in plain words:
```text
Opening stock        10,000 L
+ Deliveries          5,000 L
- Nozzle sales        3,200 L
+/- Adjustments        -50 L
= Expected stock     11,750 L
Last dip (measured)  11,700 L  ->  50 L below expected
```
Plus a movement history (date, type, litres, running balance, link to the source: delivery, shift, adjustment) and dip history.

**1. Receive Fuel** — supplier, fuel, destination tank (only tanks of that fuel), date/time, challan/invoice no., litres, rate per litre, invoice total, notes. Shows calculated amount (litres x rate) next to the invoice total and flags a mismatch; user confirms before saving. Records who received it. Blocks a delivery that would overfill the tank, and blocks the same challan number twice for the same supplier. Managers can reverse a wrong delivery with a reason (adds a reversing entry; never deletes).

**2. Stock ledger** — the only source of expected stock. Entries: opening, delivery, delivery reversal, shift sale (one per nozzle reading, added automatically when a shift closes), shift correction (the litre difference when a manager corrects a closed reading), and approved adjustment. Each entry points to its source and can only be posted once.

**3. Record Tank Dip** — tank, date/time, measured litres, notes. Clearly labelled "Physically measured stock". Explains that if you only have a dip-rod height in cm, you need the tank's calibration chart to convert it — the app does not guess. Recording a dip never changes expected stock.

**4. Adjustments** — anyone can request one (tank, litres +/-, reason, optional link to a dip, e.g. "match dip"). Owner/manager approves or rejects; only approved ones enter the ledger. Managers' own requests still need a separate approve click.

**5. Alerts** — low stock (below the tank's alert level), above capacity, negative expected stock, and dip difference beyond a threshold. Threshold is set in Settings (default: 0.5% of tank capacity, minimum 50 L).

## Rules
- Expected stock = sum of ledger entries; no other field is used.
- Existing tanks get an opening entry equal to their current stock; the already-closed test shift gets its sale entry, so totals are right from day one.
- The old "correct stock" button in Station Setup is replaced by the new adjustment request flow (history of past corrections kept).
- All litres stored with 2 decimals; calculations done in the database and mirrored in one shared calc file.
- English + Roman Urdu for every new label and message.

## Technical details
- New tables (station-scoped RLS, select-only to clients, writes via security-definer RPCs): `fuel_deliveries` (unique station+supplier+challan; reversed_at/by/reason), `stock_movements` (tank_id, kind enum, litres signed, occurred_at, source_type + source_id, unique (kind, source_id) to prevent double posting, created_by), `tank_dips`, `stock_adjustments` (status pending/approved/rejected, requested_by, reviewed_by/at). Add `stations.dip_variance_litres` nullable setting.
- RPCs: `record_delivery`, `reverse_delivery`, `record_tank_dip`, `request_stock_adjustment`, `review_stock_adjustment`. `close_shift` and `correct_closed_reading` extended to post sale / correction movements to the nozzle's tank. View/function `tank_stock_summary` returns expected, last dip, variance per tank.
- Capacity check on delivery and adjustment approval (expected + litres <= capacity); negative expected allowed but alerted (real-world meter/dip errors), never silently fixed.
- Backfill migration: opening movements from `tanks.opening_stock_litres`, sale movements from closed `shift_readings`. `opening_stock_litres` marked deprecated for live stock; `correct_tank_stock` revoked.
- Routes: `/fuel-stock` (cards + filters), `/fuel-stock/$tankId` (detail, ledger, dips). Calc module `src/lib/inventory.ts` + Vitest (deliveries, two tanks same fuel, sale movements, successive dips, approved vs pending adjustments, capacity, reversal, duplicate challan). Playwright run of receive -> close shift -> dip -> adjust -> approve.
