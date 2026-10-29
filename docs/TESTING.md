# Testing

## Automated (in repo)
Vitest unit tests: `bun run test` (or `bun run test:watch`).

| File | Tests | Covers |
|---|---|---|
| `src/lib/shifts.test.ts` | 9 | litres sold, rollover, reading issues, price snapshot, reconcile |
| `src/lib/inventory.test.ts` | 12 | stock breakdown, running balance, dip compare, alerts, delivery amount |
| `src/lib/finance.test.ts` | 8 | customer balance and ledger, credit limit, payables, drawer, sales vs collections, CSV |
| `src/lib/setup.test.ts` | 8 | current price, setup schemas and helpers |
| `src/lib/reports.test.ts` | 7 | report aggregation (closed shifts, reversals, Karachi days) |
| `src/lib/permissions.test.ts` | 3 | role matrix |
| `src/lib/i18n/i18n.test.ts` | 3 | key parity, no Urdu script, agreed terms |

## Not yet automated (recommended)
- RLS and RPC integration tests against a test database (roles, cross-station isolation, idempotency).
- Browser end-to-end tests (Playwright) for the shift wizard and reports.
- Tests that check the SQL formulas match the TypeScript ones.

## Manual acceptance checklist
- [ ] **Auth:** sign up, confirm email, sign in, sign out, forgot/reset password.
- [ ] **Station isolation:** a user on station B cannot see station A's shifts or customers.
- [ ] **Meter calculation:** opening 1000, closing 1124.5, test 5 → 119.5 L. A closing reading below the opening is blocked.
- [ ] **Rollover:** a manager sets the rollover and litres are computed through the wrap.
- [ ] **Historical prices:** close a shift, change the price, and check that the old shift and reports are unchanged.
- [ ] **Shift finalisation:** a second close is rejected. A variance needs a manager's reason. Corrections show in history.
- [ ] **Inventory:** after a delivery, sale, dip and approved adjustment, expected stock equals the ledger sum. The dip did not change stock. Reversal restores the balance.
- [ ] **Duplicate challan** is rejected.
- [ ] **Customer balance:** opening + credit − payments. Going over the limit needs approval.
- [ ] **Supplier payments:** outstanding updates. A double-click does not double post.
- [ ] **Expenses:** a drawer expense reduces expected drawer cash. A bank expense does not.
- [ ] **Roles:** staff cannot set prices, record deliveries, pay suppliers, approve, reverse or see history.
- [ ] **Language:** switch to Roman Urdu on every page. The choice persists after reload and sign-in.
- [ ] **Mobile (≈375 px):** menu, shift wizard, tables and reports are usable.
- [ ] **Reports:** CSV opens in Excel. The print layout is readable.
