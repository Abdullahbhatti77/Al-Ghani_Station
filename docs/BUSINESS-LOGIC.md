# Business logic

The formulas live in `src/lib/*.ts`, where they are used for UI previews and unit tests. The SQL RPCs repeat the same formulas, and the RPC result is the one that gets saved. All examples below are illustrative.

## Rounding
Money and litres are rounded to 2 decimals with `round2(n) = Math.round(n*100)/100` (`src/lib/shifts.ts`). The database stores `numeric`. Two values count as equal ("matched") when they differ by less than 0.005.

## Litres sold
```text
litres = closing − opening − test                     (normal)
litres = (rollover_max − opening) + closing − test    (meter rolled over)
```
Validation (`readingIssue`): closing is required; closing must be ≥ opening unless there is a rollover; closing must be ≤ rollover_max; the result must not be negative.

*Example:* opening 1,000.0, closing 1,124.5, test 5 → **119.5 L**.

## Historical price snapshot
Each shift has a `price_at` time: now for today's shift, Asia/Karachi noon for a backdated one. The price used is the latest `fuel_prices` row with `effective_at ≤ price_at` (`priceAt`). The reading stores `price_id` and `price_per_litre`, so a later price change never changes a past shift.

`amount = round2(litres × price)`. *Example:* 119.5 L × Rs 265.50 = **Rs 31,727.25**.

## Sales vs collections
```text
collected  = cash + bank + card + wallet + other
accounted  = collected + credit_sales (udhaar recorded in the shift)
difference = accounted − meter_sales   → matched / short (<0) / excess (>0)
```
*Example:* sales Rs 31,727.25, collected Rs 30,000, credit 0 → **short Rs 1,727.25**.

## Drawer cash
```text
expected = opening_float + cash_fuel + cash_udhaar_repayments + cash_in
           − drawer_expenses − cash_out
cash_variance = cash_counted − expected
```
Bank, card and wallet repayments and expenses do **not** affect the drawer. If either variance is not zero, closing requires a manager with a written reason (`close_shift`). The server computes these values in `_total_shift`.

## Expected tank stock
```text
expected = opening + deliveries − sales ± adjustments
         = Σ stock_movements.litres (signed)
```
Movements are posted only by:
- tank creation (`opening`),
- `record_delivery` / `reverse_delivery`,
- `close_shift` (`sale`),
- `correct_closed_reading` (`sale_correction`),
- an approved `review_stock_adjustment`.

*Example:* 12,000 − 119.5 = **11,880.5 L**.

## Dip variance
`difference = dip − expected_at_dip_time`. Dips never change stock. A variance above the threshold (station setting, or by default `max(50, 0.5% × capacity)`) raises an alert. To fix the stock, request an adjustment. An approved adjustment is dated at the dip time.

## Customer udhaar
`balance = opening + Σ credit_sales − Σ payments`, counting only rows that are not reversed. The credit limit check: if `balance + amount > limit`, the sale needs an approval reason from an owner or manager. *Example:* 2,655 − 1,000 = **1,655**.

## Supplier payables
`outstanding = opening_payable + Σ delivery invoice_amount − Σ payments` (rows that are not reversed). Delivery amount is `litres × rate`. A mismatch with the invoice of Rs 0.01 or more shows a warning, but the invoice amount is what counts.

## Finalised records and corrections
- A closed shift cannot be saved or closed again (`shift_already_closed`). Corrections use the `correct_*` RPCs, which need a reason, write `shift_corrections` and audit rows, and post the stock delta.
- Deliveries, payments, expenses, customer entries and cash movements are **reversed** (with a reason), never deleted.
- Prices are insert-only. Setup records are archived.

## Duplicate submissions and consistency
- Finance postings carry a client-generated `client_key` (`crypto.randomUUID()`) with a unique constraint, so a repeated submit returns the existing row instead of double posting.
- Each RPC runs in a single transaction, so a failure leaves nothing half-written.
- Stock movements are unique per (kind, source_id).

## Known gaps
- Shift start and draft saves do not use `client_key`. Starting a shift twice can create two drafts, although the unique index stops the same nozzle being open in both.
- Rounding happens per reading, so totals of rounded values can differ from a sum rounded once by up to Rs 0.01 per line.
- There is no automated test that compares the SQL formulas with the TypeScript versions. The two must be kept in sync by hand.
