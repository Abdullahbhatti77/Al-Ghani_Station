# Udhaar, Supplier Payables, Expenses and Cash Closing

Extends existing Shifts, Fuel Stock and Suppliers. Nothing is rebuilt. Every financial posting happens in one secure server-side step, so it is all-or-nothing and can never post twice. Records are never deleted — mistakes are fixed by a reversal with a reason.

## A. Customers / Udhaar
- Customer list (search, archived toggle) with big current balance; Add / Edit Customer: name, business name, phone, address, vehicle numbers, credit limit, opening balance, notes.
- **Record Credit Sale**: customer, open shift, product, litres (or amount), price taken from the shift price snapshot, vehicle, reference. If new balance exceeds limit: warning; staff cannot continue; owner/manager can approve with a written reason (saved).
- **Receive Payment**: amount, method (cash / bank / card / wallet / other), reference, optional shift. Cash payments are linked to the open shift drawer.
- Customer ledger: date, reference, description, debit, credit, running balance; date filter, print view, CSV export.
- Sales and repayments are separate transaction types; a repayment is never counted as fuel sales.

## B. Supplier Payables
- Supplier invoices **are** the existing accepted fuel deliveries (no second copy). Reversed deliveries drop out.
- **Pay Supplier**: amount, date, method, reference, notes. Duplicate check: same supplier + same reference is rejected; a one-time token stops double clicks.
- Supplier page: opening payable + purchases − payments = outstanding, all calculated from the linked records. Opening payable becomes locked once any transaction exists.
- Supplier statement with date filter, print, CSV.

## C. Expenses
- Expense form: date/time, category, description, amount, method (shift drawer / bank / other), linked shift when from drawer, reference, recorded-by (automatic).
- Starter categories: Salaries, Electricity, Repairs, Refreshments, Station Supplies, Other. Managers add/rename/archive categories.
- List with date + category filters, totals, CSV. Only drawer-paid expenses reduce shift cash. Reversal with reason.

## D. Cash Closing (shift review step rebuilt as three separate panels)
1. **Sales collection**: meter sales vs cash fuel collected + digital (bank/card/wallet/other) + credit sales linked to this shift.
2. **Drawer cash**: expected = opening float + cash fuel collections + cash udhaar repayments in this shift + other cash in − drawer expenses − cash removals/bank deposits; vs **counted cash** (new field). Shows surplus/shortage in PKR.
3. **Fuel stock**: link to tank stock & dip status (unchanged dip process; informational only).
- Green when matched, amber/red warnings when not; amounts are never adjusted automatically.
- Closing with any variance needs owner/manager explanation, saved in the shift audit trail. Staff can't close with a variance.
- New small actions on the shift: "Cash In (other)" and "Cash Removed / Bank Deposit".
- Already-closed shifts keep their stored totals; new fields default to 0.

## E. Forms and UX
- Quick actions on Dashboard + relevant pages: Add Customer, Record Credit Sale, Receive Payment, Receive Fuel Delivery, Pay Supplier, Add Expense.
- Large inputs, confirmation step before posting, localized success/error messages, English + Roman Urdu everywhere.
- Dashboard tiles "Total udhaar" and "Today's expenses" show real figures (empty until records exist).

## Technical details
- New tables (station_id + station RLS, read-only to clients): `customers`, `customer_transactions` (kind: opening/credit_sale/payment/reversal, shift_id, product, litres, price_id, method, approval fields, idempotency key unique), `supplier_payments`, `expense_categories` (seeded per station on first use), `expenses`, `shift_cash_movements` (cash_in / cash_out). `shifts` gains `cash_counted`, `credit_sales`, `drawer_expected`, `cash_variance`, `variance_reason`, `variance_approved_by`.
- Customer master and categories editable by owner/manager via RLS; all money postings only via security-definer RPCs: `record_credit_sale`, `receive_customer_payment`, `reverse_customer_txn`, `pay_supplier`, `reverse_supplier_payment`, `record_expense`, `reverse_expense`, `record_shift_cash_movement`. Each locks the shift/customer row and rejects closed shifts.
- `close_shift` extended: computes credit sales, drawer expected, both variances; requires reason + manager role when non-zero. `_total_shift` keeps meter formula unchanged.
- Credit sales do not create stock movements (meter sales already do) — prevents double stock deduction.
- Balances computed in SQL views/functions (`customer_balance`, `supplier_balance`) and mirrored by pure functions in `src/lib/finance.ts` with Vitest tests: ledger running balance, credit-limit check, drawer formula (digital repayments excluded, bank expenses excluded), collection variance, supplier outstanding with reversed deliveries excluded.
- New i18n files `finance.en.ts` / `finance.ur.ts`; routes `/customers`, `/customers/$id`, `/suppliers`, `/suppliers/$id`, `/expenses`; printable statement via print stylesheet; CSV via client-side generator.
- Verification: unit tests + Playwright run of credit sale over limit, cash and bank repayment, delivery → supplier invoice, payment + duplicate rejection, drawer vs bank expense, shift close with variance reason, reversals and ledger balances.
- AGENTS.md: rule that customer/supplier/expense balances are derived from transactions only and postings go through RPCs.
