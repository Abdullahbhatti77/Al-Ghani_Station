# Finish PumpHisab MVP

Builds on everything that already works (setup, shifts, fuel stock, udhaar, suppliers, expenses). Nothing is rebuilt.

## 1. Reports (`/reports`)
- Date-range picker with presets (Today, Yesterday, This week, This month, Custom); the period is shown on every report and kept in the page address.
- Tabs: Daily Sales, Sales by Product, Sales by Nozzle, Shift Closing, Cash Surplus/Shortage, Tank Stock and Dip Variance, Deliveries, Customer Balances, Supplier Payables, Expenses.
- Each report shows PKR and litre totals, a short plain-language explanation, an empty state, CSV download and a print view (print styles hide the sidebar).
- All numbers come from closed shifts, readings, stock ledger, dips, deliveries, transactions and expenses; reversed entries are excluded.
- Mobile: tables become stacked cards.

## 2. Dashboard
- Cards: today's sales (PKR), litres sold, cash actually received, customer udhaar outstanding, current shift status, expected stock per tank, last dip difference, supplier balances outstanding.
- Each card links to its page. Empty values show "No records yet", never zero or sample numbers.
- A "Profit" card says "Not available — purchase costs are not tracked per sale".

## 3. Roles
- Owner: station profile, prices, staff, everything else.
- Manager: operational records, approvals, corrections, reports.
- Attendant (staff): their own assigned shifts, udhaar sales/payments inside their shift, dips; read-only elsewhere; no reports, no reversals, no approvals.
- Backend: tighten every write function and table policy to these roles (price inserts and staff management owner-only; reversals, corrections, approvals, deliveries, supplier payments manager+; attendant shift writes only on shifts where they are the attendant).
- UI: a single permission helper hides actions and blocks pages the role can't use.
- Staff access in Settings: owner adds an existing PumpHisab account by email with a role, changes roles, removes members (cannot remove/demote the last owner).

## 4. Audit history
- A new history record, written only by backend functions (clients cannot write or edit it): user, time, record type/reference, action, reason, before/after details.
- Logged for: shift close, closed-shift corrections, price changes, stock adjustment request/approve/reject, over-limit credit approvals, supplier payments and reversals, expense and udhaar reversals, delivery reversals, role changes, settings changes.
- Owner/manager page "History" with filters by date and type, in both languages. Wording will not claim it is tamper-proof.

## 5. Settings
- Sections: Station profile, Language (saved to account, survives refresh), Fuel alert thresholds (low-stock per tank, dip variance), Expense categories (add/rename/archive), Staff access, Account (name, change password, sign out).
- Translation sweep across all screens, dialogs, validation errors, date pickers and empty/loading states; one shared PKR and litre formatter used everywhere.

## 6. Reliability sweep
- Remove any remaining "Coming soon" links and dead buttons; check every sidebar route opens.
- Disable buttons while saving, confirm consequential actions, toast success/failure with translated messages, loading indicators on lists.

## 7. End-to-end test
On a fresh isolated demo station (separate test account): create station → products/tanks/nozzles/prices → start shift → readings → credit sale + collections → close → delivery → dip → customer debt + repayment → supplier payment + expense → dashboard and every report → switch to Roman Urdu → sign in as manager and attendant accounts to confirm restrictions → confirm a second station cannot read the first. Also confirm old prices on closed shifts don't change after a price update, balances reconcile, and stock movements aren't duplicated.

Final summary will list features, database changes, what is not integrated (no hardware pumps, no FBR/tax compliance, no email invites), and a manual pre-deployment checklist.

## Technical details
- Migration: `audit_log` table (station_id, actor, action, entity, entity_id, reason, details jsonb), SELECT for owner/manager, no client writes; `_audit()` security-definer helper called from existing RPCs (redefined with role checks). New RPCs: `add_station_member(email, role)`, `set_member_role`, `remove_member`, `update_station_settings`. Price insert policy restricted to owner.
- Reports computed client-side from station-scoped queries in `src/lib/reports.ts` with unit tests (totals, reversal exclusion, CSV escaping); role matrix in `src/lib/permissions.ts` with tests.
- New i18n keys in en/ur with existing parity test.
