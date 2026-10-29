import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/lib/i18n";
import { round2, type Collections, COLLECTION_FIELDS } from "@/lib/shifts";

type T = Database["public"]["Tables"];
export type Customer = T["customers"]["Row"];
export type CustomerTxn = T["customer_transactions"]["Row"];
export type SupplierPayment = T["supplier_payments"]["Row"];
export type ExpenseCategory = T["expense_categories"]["Row"];
export type Expense = T["expenses"]["Row"];
export type CashMovement = T["shift_cash_movements"]["Row"];

export const PAYMENT_METHODS = ["cash", "bank", "card", "wallet", "other"] as const;
export const SUPPLIER_METHODS = ["bank", "cash", "cheque", "wallet", "other"] as const;
export const EXPENSE_METHODS = ["drawer", "bank", "other"] as const;

// ---------- pure calculations (mirrored by customer_balance / supplier_balance / _total_shift in SQL) ----------

type TxnLike = Pick<CustomerTxn, "kind" | "amount" | "reversed_at">;
const live = <X extends { reversed_at: string | null }>(xs: X[]) => xs.filter((x) => !x.reversed_at);

/** Customer balance = opening + credit sales − payments. Reversed entries never count. */
export function customerBalance(opening: number, txns: TxnLike[]) {
  return round2(live(txns).reduce((s, x) => s + (x.kind === "credit_sale" ? Number(x.amount) : -Number(x.amount)), Number(opening)));
}

export type LedgerRow<X> = X & { debit: number; credit: number; balance: number };
/** Running ledger, oldest first. Reversed rows are shown with zero effect. */
export function customerLedger<X extends TxnLike & Pick<CustomerTxn, "occurred_at" | "created_at">>(opening: number, txns: X[]): LedgerRow<X>[] {
  let bal = Number(opening);
  return [...txns]
    .sort((a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at) || +new Date(a.created_at) - +new Date(b.created_at))
    .map((x) => {
      const on = !x.reversed_at;
      const debit = on && x.kind === "credit_sale" ? Number(x.amount) : 0;
      const credit = on && x.kind === "payment" ? Number(x.amount) : 0;
      bal = round2(bal + debit - credit);
      return { ...x, debit, credit, balance: bal };
    });
}

/** Would this credit sale go over the limit? `null` limit = no limit. */
export function creditCheck(balance: number, amount: number, limit: number | null) {
  const newBalance = round2(balance + amount);
  return { newBalance, over: limit !== null && newBalance > Number(limit), excess: limit === null ? 0 : round2(Math.max(0, newBalance - Number(limit))) };
}

/** Outstanding payable = opening + accepted (not reversed) delivery invoices − payments (not reversed). */
export function supplierOutstanding(
  opening: number,
  deliveries: { invoice_amount: number; reversed_at: string | null }[],
  payments: { amount: number; reversed_at: string | null }[],
) {
  const purchases = round2(live(deliveries).reduce((s, d) => s + Number(d.invoice_amount), 0));
  const paid = round2(live(payments).reduce((s, p) => s + Number(p.amount), 0));
  return { purchases, paid, outstanding: round2(Number(opening) + purchases - paid) };
}

export type DrawerInput = { float: number; cashFuel: number; cashRepayments: number; cashIn: number; drawerExpenses: number; cashOut: number };
/** Expected drawer cash = float + cash fuel + cash udhaar repayments + other cash in − drawer expenses − cash removed. */
export const drawerExpected = (d: DrawerInput) => round2(d.float + d.cashFuel + d.cashRepayments + d.cashIn - d.drawerExpenses - d.cashOut);

export type Status = "matched" | "short" | "excess";
export const statusOf = (diff: number): Status => (Math.abs(diff) < 0.005 ? "matched" : diff < 0 ? "short" : "excess");

/** Meter sales vs (cash + digital fuel collections + credit sales). */
export function salesCollection(meterSales: number, c: Collections, creditSales: number) {
  const collected = round2(COLLECTION_FIELDS.reduce((s, f) => s + (Number(c[f]) || 0), 0));
  const accounted = round2(collected + creditSales);
  const difference = round2(accounted - meterSales);
  return { collected, creditSales: round2(creditSales), accounted, difference, status: statusOf(difference) };
}

/** Sum the shift-linked records that affect the drawer. Only cash repayments and drawer-paid expenses count. */
export function shiftLinked(txns: Pick<CustomerTxn, "kind" | "amount" | "method" | "reversed_at">[], expenses: Pick<Expense, "amount" | "method" | "reversed_at">[], moves: Pick<CashMovement, "kind" | "amount" | "reversed_at">[]) {
  const sum = (xs: { amount: number }[]) => round2(xs.reduce((s, x) => s + Number(x.amount), 0));
  const lt = live(txns);
  return {
    creditSales: sum(lt.filter((x) => x.kind === "credit_sale")),
    cashRepayments: sum(lt.filter((x) => x.kind === "payment" && x.method === "cash")),
    drawerExpenses: sum(live(expenses).filter((e) => e.method === "drawer")),
    cashIn: sum(live(moves).filter((m) => m.kind === "cash_in")),
    cashOut: sum(live(moves).filter((m) => m.kind === "cash_out")),
  };
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCSV(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const newKey = () => crypto.randomUUID();

// ---------- queries ----------
async function all<R>(table: keyof T, stationId: string, order: string): Promise<R[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = supabase.from(table as "customers").select("*") as any;
  const { data, error } = await q.eq("station_id", stationId).order(order, { ascending: false }).limit(10000);
  if (error) throw error;
  return data as R[];
}
export const customersQuery = (s: string) => queryOptions({ queryKey: ["customers", s], queryFn: () => all<Customer>("customers", s, "name") });
export const customerTxnsQuery = (s: string) => queryOptions({ queryKey: ["customer_transactions", s], queryFn: () => all<CustomerTxn>("customer_transactions", s, "occurred_at") });
export const supplierPaymentsQuery = (s: string) => queryOptions({ queryKey: ["supplier_payments", s], queryFn: () => all<SupplierPayment>("supplier_payments", s, "paid_at") });
export const categoriesQuery = (s: string) => queryOptions({ queryKey: ["expense_categories", s], queryFn: () => all<ExpenseCategory>("expense_categories", s, "name") });
export const expensesQuery = (s: string) => queryOptions({ queryKey: ["expenses", s], queryFn: () => all<Expense>("expenses", s, "occurred_at") });
export const cashMovesQuery = (s: string) => queryOptions({ queryKey: ["shift_cash_movements", s], queryFn: () => all<CashMovement>("shift_cash_movements", s, "created_at") });
export const openShiftsQuery = (s: string) =>
  queryOptions({
    queryKey: ["shifts-open", s, "full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("id, name, shift_date, price_at").eq("station_id", s).eq("status", "draft").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
export const FINANCE_KEYS = ["customers", "customer_transactions", "supplier_payments", "expense_categories", "expenses", "shift_cash_movements", "shift", "shifts", "shifts-open", "suppliers"];

export function financeErrorKey(err: { message?: string } | null): TranslationKey {
  const m = err?.message ?? "";
  const map: [string, TranslationKey][] = [
    ["over_limit_needs_manager", "fin.err.overLimitManager"],
    ["over_limit", "fin.err.overLimit"],
    ["duplicate_payment", "fin.err.duplicatePayment"],
    ["opening_locked", "fin.err.openingLocked"],
    ["shift_closed", "fin.err.shiftClosed"],
    ["bad_shift", "fin.err.shiftClosed"],
    ["shift_required", "fin.err.shiftRequired"],
    ["shift_cash_only", "fin.err.shiftCashOnly"],
    ["customer_archived", "fin.err.archived"],
    ["already_reversed", "inv.err.alreadyReversed"],
    ["no_price", "shift.err.noPrice"],
    ["future_date", "inv.err.futureDate"],
    ["reason_required", "validation.reasonMin"],
    ["variance_needs_manager", "fin.err.varianceManager"],
    ["cash_count_missing", "fin.err.cashCountMissing"],
    ["expense_categories_name_uq", "setup.err.duplicate"],
    ["bad_amount", "validation.positive"],
    ["attendant_own_shift_only", "err.ownShift"],
    ["attendant_needs_shift", "err.needShift"],
    ["forbidden", "shift.err.forbidden"],
  ];
  return map.find(([k]) => m.includes(k))?.[1] ?? "setup.err.generic";
}
