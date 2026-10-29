import { describe, expect, it } from "vitest";
import { creditCheck, customerBalance, customerLedger, drawerExpected, salesCollection, shiftLinked, supplierOutstanding, toCSV } from "./finance";

const tx = (kind: "credit_sale" | "payment", amount: number, at: string, extra: Record<string, unknown> = {}) =>
  ({ kind, amount, occurred_at: at, created_at: at, reversed_at: null, method: kind === "payment" ? "cash" : null, ...extra }) as unknown as Parameters<typeof customerLedger>[1][number];

describe("customer udhaar", () => {
  it("balance = opening + credit sales − repayments; reversed entries ignored", () => {
    const txns = [tx("credit_sale", 5000, "2026-10-01"), tx("payment", 2000, "2026-10-02"), tx("credit_sale", 999, "2026-10-03", { reversed_at: "2026-10-03" })];
    expect(customerBalance(1000, txns)).toBe(4000);
  });
  it("ledger runs debit/credit/balance oldest first", () => {
    const rows = customerLedger(1000, [tx("payment", 500, "2026-10-02"), tx("credit_sale", 3000, "2026-10-01")]);
    expect(rows.map((r) => [r.debit, r.credit, r.balance])).toEqual([[3000, 0, 4000], [0, 500, 3500]]);
  });
  it("credit limit warns only when the new balance exceeds it", () => {
    expect(creditCheck(40000, 10000, 50000).over).toBe(false);
    expect(creditCheck(40000, 10000.01, 50000)).toEqual({ newBalance: 50000.01, over: true, excess: 0.01 });
    expect(creditCheck(1e9, 1, null).over).toBe(false);
  });
});

describe("supplier payable", () => {
  it("outstanding = opening + accepted invoices − payments, reversals excluded", () => {
    const r = supplierOutstanding(10000, [{ invoice_amount: 500000, reversed_at: null }, { invoice_amount: 1, reversed_at: "x" }], [{ amount: 300000, reversed_at: null }, { amount: 7, reversed_at: "x" }]);
    expect(r).toEqual({ purchases: 500000, paid: 300000, outstanding: 210000 });
  });
});

describe("cash closing", () => {
  it("drawer formula: float + cash fuel + cash repayments + cash in − drawer expenses − cash removed", () => {
    expect(drawerExpected({ float: 5000, cashFuel: 100000, cashRepayments: 3000, cashIn: 500, drawerExpenses: 1200, cashOut: 50000 })).toBe(57300);
  });
  it("only cash repayments and drawer expenses touch the drawer", () => {
    const linked = shiftLinked(
      [tx("credit_sale", 8000, "d"), tx("payment", 3000, "d"), tx("payment", 4000, "d", { method: "bank" })],
      [{ amount: 1200, method: "drawer", reversed_at: null }, { amount: 9000, method: "bank", reversed_at: null }] as never,
      [{ kind: "cash_out", amount: 50000, reversed_at: null }, { kind: "cash_in", amount: 1, reversed_at: "x" }] as never,
    );
    expect(linked).toEqual({ creditSales: 8000, cashRepayments: 3000, drawerExpenses: 1200, cashIn: 0, cashOut: 50000 });
  });
  it("credit sales count toward fuel sales collection; repayments do not", () => {
    const c = { cash_received: 90000, bank_received: 2000, card_received: 0, wallet_received: 0, other_received: 0 };
    expect(salesCollection(100000, c, 8000)).toMatchObject({ accounted: 100000, difference: 0, status: "matched" });
    expect(salesCollection(100000, c, 0)).toMatchObject({ difference: -8000, status: "short" });
  });
});

describe("csv", () => {
  it("escapes commas and quotes", () => {
    expect(toCSV(["a", "b"], [["x,y", 'say "hi"']])).toBe('a,b\n"x,y","say ""hi"""');
  });
});
