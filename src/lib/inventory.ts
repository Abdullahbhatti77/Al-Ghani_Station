import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/lib/i18n";
import type { Tank } from "@/lib/setup";
import { round2 } from "@/lib/shifts";

type T = Database["public"]["Tables"];
export type StockMovement = T["stock_movements"]["Row"];
export type TankDip = T["tank_dips"]["Row"];
export type FuelDelivery = T["fuel_deliveries"]["Row"];
export type StockAdjustment = T["stock_adjustments"]["Row"];
export type MovementKind = "opening" | "delivery" | "delivery_reversal" | "sale" | "sale_correction" | "adjustment";

// ---------- pure calculations (expected stock = sum of ledger, same as public.tank_expected) ----------

export type Breakdown = { opening: number; deliveries: number; sales: number; adjustments: number; expected: number };

/** opening + deliveries − sales ± adjustments = expected. Reversals count against deliveries, sale corrections against sales. */
export function breakdown(movs: Pick<StockMovement, "kind" | "litres" | "occurred_at">[], at?: Date): Breakdown {
  const b = { opening: 0, deliveries: 0, sales: 0, adjustments: 0 };
  for (const m of movs) {
    if (at && new Date(m.occurred_at) > at) continue;
    const l = Number(m.litres);
    if (m.kind === "opening") b.opening += l;
    else if (m.kind === "delivery" || m.kind === "delivery_reversal") b.deliveries += l;
    else if (m.kind === "sale" || m.kind === "sale_correction") b.sales -= l;
    else b.adjustments += l;
  }
  const r = { opening: round2(b.opening), deliveries: round2(b.deliveries), sales: round2(b.sales), adjustments: round2(b.adjustments) };
  return { ...r, expected: round2(r.opening + r.deliveries - r.sales + r.adjustments) };
}

/** Running balance per movement, oldest first. */
export function withBalance<M extends Pick<StockMovement, "litres" | "occurred_at" | "created_at">>(movs: M[]) {
  let bal = 0;
  return [...movs]
    .sort((a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at) || +new Date(a.created_at) - +new Date(b.created_at))
    .map((m) => ({ ...m, balance: (bal = round2(bal + Number(m.litres))) }));
}

/** Default variance threshold: 0.5% of capacity, at least 50 L. */
export const defaultThreshold = (capacity: number) => Math.max(50, round2(capacity * 0.005));

export type DipCompare = { dip: TankDip; expectedAtDip: number; difference: number; status: "above" | "below" | "equal" };
export function compareDip(movs: StockMovement[], dips: TankDip[]): DipCompare | null {
  const dip = [...dips].sort((a, b) => +new Date(b.measured_at) - +new Date(a.measured_at))[0];
  if (!dip) return null;
  const expectedAtDip = breakdown(movs, new Date(dip.measured_at)).expected;
  const difference = round2(Number(dip.measured_litres) - expectedAtDip);
  return { dip, expectedAtDip, difference, status: Math.abs(difference) < 0.005 ? "equal" : difference > 0 ? "above" : "below" };
}

export type Alert = "low" | "overCapacity" | "negative" | "variance";
export function tankAlerts(tank: Pick<Tank, "capacity_litres" | "low_stock_litres">, expected: number, cmp: DipCompare | null, threshold: number | null): Alert[] {
  const a: Alert[] = [];
  const cap = Number(tank.capacity_litres);
  if (expected < 0) a.push("negative");
  else if (expected <= Number(tank.low_stock_litres)) a.push("low");
  if (expected > cap) a.push("overCapacity");
  const th = threshold ?? defaultThreshold(cap);
  if (cmp && Math.abs(cmp.difference) > th) a.push("variance");
  return a;
}

export const deliveryAmount = (litres: number, rate: number) => round2(litres * rate);
export const invoiceMismatch = (litres: number, rate: number, invoice: number) => Math.abs(deliveryAmount(litres, rate) - invoice) >= 0.01;

// ---------- queries ----------
const byStation = <K extends "stock_movements" | "tank_dips" | "fuel_deliveries" | "stock_adjustments">(table: K, order: string) =>
  async (stationId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = supabase.from(table as "tank_dips").select("*") as any;
    const { data, error } = await q.eq("station_id", stationId).order(order, { ascending: false }).limit(5000);
    if (error) throw error;
    return data as T[K]["Row"][];
  };
export const movementsQuery = (s: string) => queryOptions({ queryKey: ["stock_movements", s], queryFn: () => byStation("stock_movements", "occurred_at")(s) });
export const dipsQuery = (s: string) => queryOptions({ queryKey: ["tank_dips", s], queryFn: () => byStation("tank_dips", "measured_at")(s) });
export const deliveriesQuery = (s: string) => queryOptions({ queryKey: ["fuel_deliveries", s], queryFn: () => byStation("fuel_deliveries", "delivered_at")(s) });
export const adjustmentsQuery = (s: string) => queryOptions({ queryKey: ["stock_adjustments", s], queryFn: () => byStation("stock_adjustments", "requested_at")(s) });
export const INVENTORY_KEYS = ["stock_movements", "tank_dips", "fuel_deliveries", "stock_adjustments"];

export function inventoryErrorKey(err: { message?: string } | null): TranslationKey {
  const m = err?.message ?? "";
  const map: [string, TranslationKey][] = [
    ["over_capacity", "inv.err.overCapacity"],
    ["duplicate_challan", "inv.err.duplicateChallan"],
    ["fuel_deliveries_unique_challan", "inv.err.duplicateChallan"],
    ["already_reversed", "inv.err.alreadyReversed"],
    ["already_reviewed", "inv.err.alreadyReviewed"],
    ["future_date", "inv.err.futureDate"],
    ["reason_required", "validation.reasonMin"],
    ["forbidden", "shift.err.forbidden"],
    ["bad_amount", "validation.positive"],
  ];
  return map.find(([k]) => m.includes(k))?.[1] ?? "setup.err.generic";
}

/** Value for <input type="datetime-local"> in the browser's local time. */
export const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
