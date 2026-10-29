import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Shift, ShiftReading } from "@/lib/shifts";
import { round2 } from "@/lib/shifts";
import type { Customer, CustomerTxn, Expense, SupplierPayment } from "@/lib/finance";
import { customerBalance, supplierOutstanding } from "@/lib/finance";
import type { FuelDelivery, StockMovement, TankDip } from "@/lib/inventory";
import { breakdown, compareDip } from "@/lib/inventory";

/** Calendar date (YYYY-MM-DD) of a timestamp in Pakistan time. */
export const karachiDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(iso));
/** End of a Karachi calendar day as a Date (23:59:59.999 PKT). */
export const endOfKarachiDay = (d: string) => new Date(`${d}T23:59:59.999+05:00`);
export const startOfKarachiDay = (d: string) => new Date(`${d}T00:00:00+05:00`);

export type Range = { from: string; to: string };
const inRange = (d: string, r: Range) => d >= r.from && d <= r.to;
const sum = <X>(xs: X[], f: (x: X) => number) => round2(xs.reduce((a, x) => a + f(x), 0));
const live = <X extends { reversed_at: string | null }>(xs: X[]) => xs.filter((x) => !x.reversed_at);

export type Preset = "today" | "yesterday" | "week" | "month" | "custom";
export function presetRange(p: Exclude<Preset, "custom">, today: string): Range {
  const d = new Date(`${today}T12:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (p === "today") return { from: today, to: today };
  if (p === "yesterday") { d.setUTCDate(d.getUTCDate() - 1); return { from: iso(d), to: iso(d) }; }
  if (p === "week") { const s = new Date(d); s.setUTCDate(d.getUTCDate() - 6); return { from: iso(s), to: today }; }
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

type ShiftLike = Pick<Shift, "id" | "shift_date" | "status" | "total_litres" | "total_sales" | "total_collected" | "credit_sales" | "difference" | "cash_variance">;
export const closedInRange = <S extends ShiftLike>(shifts: S[], r: Range) => shifts.filter((s) => s.status === "closed" && inRange(s.shift_date, r));

export function dailySales(shifts: ShiftLike[], r: Range) {
  const by = new Map<string, { date: string; shifts: number; litres: number; sales: number; collected: number; credit: number }>();
  for (const s of closedInRange(shifts, r)) {
    const x = by.get(s.shift_date) ?? { date: s.shift_date, shifts: 0, litres: 0, sales: 0, collected: 0, credit: 0 };
    x.shifts += 1;
    x.litres = round2(x.litres + Number(s.total_litres ?? 0));
    x.sales = round2(x.sales + Number(s.total_sales ?? 0));
    x.collected = round2(x.collected + Number(s.total_collected ?? 0));
    x.credit = round2(x.credit + Number(s.credit_sales ?? 0));
    by.set(s.shift_date, x);
  }
  return [...by.values()].sort((a, b) => b.date.localeCompare(a.date));
}

type ReadingLike = Pick<ShiftReading, "shift_id" | "nozzle_id" | "product_id" | "litres_sold" | "amount">;
export function salesBy(key: "product_id" | "nozzle_id", readings: ReadingLike[], shifts: ShiftLike[], r: Range) {
  const ids = new Set(closedInRange(shifts, r).map((s) => s.id));
  const by = new Map<string, { id: string; litres: number; amount: number }>();
  for (const x of readings) {
    if (!ids.has(x.shift_id)) continue;
    const k = x[key];
    const v = by.get(k) ?? { id: k, litres: 0, amount: 0 };
    v.litres = round2(v.litres + Number(x.litres_sold ?? 0));
    v.amount = round2(v.amount + Number(x.amount ?? 0));
    by.set(k, v);
  }
  return [...by.values()].sort((a, b) => b.amount - a.amount);
}

export function varianceTotals(shifts: ShiftLike[], r: Range) {
  const c = closedInRange(shifts, r);
  const d = c.map((s) => Number(s.difference ?? 0));
  const cash = c.map((s) => Number(s.cash_variance ?? 0));
  return {
    shortage: round2(d.filter((x) => x < 0).reduce((a, x) => a + x, 0)),
    surplus: round2(d.filter((x) => x > 0).reduce((a, x) => a + x, 0)),
    net: round2(d.reduce((a, x) => a + x, 0)),
    cashNet: round2(cash.reduce((a, x) => a + x, 0)),
  };
}

export function tankReport(movs: StockMovement[], dips: TankDip[], r: Range) {
  const before = new Date(startOfKarachiDay(r.from).getTime() - 1);
  const end = endOfKarachiDay(r.to);
  const start = breakdown(movs, before).expected;
  const closing = breakdown(movs, end).expected;
  const inside = movs.filter((m) => inRange(karachiDate(m.occurred_at), r));
  const k = (kinds: string[]) => sum(inside.filter((m) => kinds.includes(m.kind)), (m) => Number(m.litres));
  const dipsInRange = dips.filter((d) => inRange(karachiDate(d.measured_at), r));
  return {
    opening: start,
    deliveries: k(["delivery", "delivery_reversal"]),
    sales: round2(-k(["sale", "sale_correction"])),
    adjustments: k(["adjustment", "opening"]),
    closing,
    dip: compareDip(movs, dipsInRange),
  };
}

export function deliveriesIn(ds: FuelDelivery[], r: Range) {
  const rows = live(ds).filter((d) => inRange(karachiDate(d.delivered_at), r));
  return { rows, litres: sum(rows, (d) => Number(d.litres)), amount: sum(rows, (d) => Number(d.invoice_amount)) };
}

export function customerBalancesAt(customers: Customer[], txns: CustomerTxn[], asOf: string) {
  const end = endOfKarachiDay(asOf);
  return customers
    .map((c) => ({ customer: c, balance: customerBalance(Number(c.opening_balance), txns.filter((x) => x.customer_id === c.id && new Date(x.occurred_at) <= end)) }))
    .filter((x) => x.balance !== 0)
    .sort((a, b) => b.balance - a.balance);
}

export function supplierPayablesAt(
  suppliers: { id: string; business_name: string; opening_payable: number }[],
  deliveries: FuelDelivery[],
  payments: SupplierPayment[],
  asOf: string,
) {
  const end = endOfKarachiDay(asOf);
  return suppliers
    .map((s) => ({
      supplier: s,
      ...supplierOutstanding(
        Number(s.opening_payable),
        deliveries.filter((d) => d.supplier_id === s.id && new Date(d.delivered_at) <= end),
        payments.filter((p) => p.supplier_id === s.id && new Date(p.paid_at) <= end),
      ),
    }))
    .filter((x) => x.outstanding !== 0 || x.purchases !== 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}

export function expensesIn(xs: Expense[], r: Range) {
  const rows = live(xs).filter((x) => inRange(karachiDate(x.occurred_at), r));
  const byCat = new Map<string, number>();
  for (const x of rows) byCat.set(x.category_id, round2((byCat.get(x.category_id) ?? 0) + Number(x.amount)));
  return { rows, total: sum(rows, (x) => Number(x.amount)), byCategory: [...byCat.entries()].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount) };
}

export const readingsQuery = (stationId: string) =>
  queryOptions({
    queryKey: ["shift_readings", stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_readings")
        .select("shift_id, nozzle_id, product_id, litres_sold, amount")
        .eq("station_id", stationId)
        .eq("is_draft", false)
        .limit(20000);
      if (error) throw error;
      return data;
    },
  });

export const allShiftsQuery = (stationId: string) =>
  queryOptions({
    queryKey: ["shifts", stationId, "all-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").eq("station_id", stationId).order("shift_date", { ascending: false }).limit(5000);
      if (error) throw error;
      return data;
    },
  });

export const auditQuery = (stationId: string) =>
  queryOptions({
    queryKey: ["audit_log", stationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").eq("station_id", stationId).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
