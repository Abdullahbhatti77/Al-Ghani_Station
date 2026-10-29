# Features

Status key: **Implemented** = in the code and used by the UI. **Partial** = present but limited or not fully tested. **Planned** = not built.

## Glossary
- **Nozzle reading:** the cumulative litre counter on a dispenser nozzle.
- **Test litres:** fuel pumped out during a meter test and returned to the tank. It is not a sale.
- **Tank dip:** a physical measurement of the fuel in a tank (using a dip rod).
- **Udhaar:** credit given to a regular customer, to be paid back later.
- **Shift reconciliation:** comparing metered sales with the money collected.
- **Stock variance:** the difference between a dip and the stock the ledger expects.

## Authentication and onboarding — Implemented
Email/password sign-up (with email confirmation), sign-in, forgot and reset password (`/auth`, `/forgot-password`, `/reset-password`). A first-time user creates a station (name, city, phone, language) through `create_station_with_owner` and becomes its owner. *Partial:* the password-reset email has not been verified end-to-end.

## Dashboard — Implemented
Today's sales, litres, shift status, udhaar outstanding, expenses, stock alerts, a setup checklist and quick actions. A figure stays empty until real records exist.

## Station setup (`/setup?step=...`) — Implemented
Owner and manager can edit. Staff can only view.
1. **Products:** name, code and unit (`litre`, `kg` or `piece`). Products are archived, never deleted.
2. **Tanks:** product, capacity, opening stock (only at creation; must be ≤ capacity), low-stock level.
3. **Nozzles:** number, name, product, tank. The tank must hold the same product, which the UI and the `check_nozzle_tank` trigger both check.
4. **Prices:** owner only. Adding a price creates a new row and the full history is kept.
5. **Suppliers:** business name, contact details, opening payable.
6. **Review:** completeness checklist.

## Shifts (`/shifts`, `/shifts/$shiftId`) — Implemented
- **Start:** date, name, attendant and opening float. An attendant can start a shift only for themselves.
- **Readings:** the opening reading is filled in from the nozzle meter. Enter the closing reading and test litres. A closing reading below the opening is blocked. Drafts are saved and can be resumed later.
- **Review:** litres and amount for each nozzle, priced at the shift's price time.
- **Reconcile:** three panels: sales vs collections (cash/bank/card/wallet/other plus credit sales), drawer cash (counted vs expected), and linked udhaar, expenses and cash movements.
- **Close:** a manager must give a reason when there is a variance. A shift cannot be closed twice.
- **Corrections (manager/owner):** opening, closing and test litres, collections, and meter rollover. Each needs a reason and is recorded in `shift_corrections`.
- *Partial:* multi-nozzle and rollover flows are tested at unit level only.

## Fuel stock (`/fuel-stock`, `/fuel-stock/$tankId`) — Implemented
- Expected stock for each tank comes from the movement ledger.
- **Deliveries** (owner/manager): supplier, tank, challan number (unique per supplier), litres, rate and invoice amount. The app warns when the invoice doesn't equal litres × rate. Deliveries can be reversed with a reason.
- **Dips:** recorded against the expected stock. A dip never changes stock.
- **Adjustments:** anyone can request one. An owner or manager approves or rejects it, and only an approved adjustment posts a movement.
- **Alerts:** low stock, over capacity, negative stock, and dip variance above the threshold (default 0.5% of capacity, minimum 50 L; set in Settings).

## Udhaar / customers (`/customers`) — Implemented
Customer profile (vehicles, credit limit, opening balance), credit sales (optionally linked to a shift), repayments by method, and a running ledger. Going over the credit limit needs manager approval with a reason. Entries are reversed, never deleted. The opening balance is locked once entries exist.

## Suppliers (`/suppliers`) — Implemented
Statement of the opening payable, accepted deliveries (the invoices) and payments. Paying a supplier is limited to owner and manager, and payments can be reversed.

## Expenses (`/expenses`) — Implemented
Category, amount and method. `drawer` expenses must be linked to a shift and reduce expected drawer cash. Default categories are created for each new station, and owners and managers can manage them in Settings.

## Reports (`/reports`) — Implemented
Daily sales, sales by fuel, sales by nozzle, shift closing, cash short/excess, tank stock & dips, deliveries, customer udhaar, supplier payables, expenses. Each has date presets or a custom range, CSV export and a print layout. Reports use closed shifts only and exclude reversed rows.

## History (`/history`) — Implemented
The audit log for owners and managers. It is written only by database triggers and RPCs.

## Settings (`/settings`) — Implemented
Station profile (owner), language, dip variance threshold, expense categories, staff (owner adds an existing account by email, changes roles or removes; the last owner is protected), and account.

## Planned / not implemented
- Email invitations for people without an account.
- Multiple stations per user in the UI.
- Lubricant and shop sales.
- Hardware (dispenser/ATG) and regulatory integrations.
- Offline support and notifications.
