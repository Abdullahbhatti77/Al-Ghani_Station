import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/lib/i18n";
import type { FuelPrice } from "@/lib/setup";

type T = Database["public"]["Tables"];
export type Shift = T["shifts"]["Row"];
export type ShiftReading = T["shift_readings"]["Row"];
export type ShiftCorrection = T["shift_corrections"]["Row"];

export const SHIFT_STEPS = ["start", "readings", "review", "reconcile", "close"] as const;
export type ShiftStep = (typeof SHIFT_STEPS)[number];

export const COLLECTION_FIELDS = ["cash_received", "bank_received", "card_received", "wallet_received", "other_received"] as const;
export type CollectionField = (typeof COLLECTION_FIELDS)[number];

// ---------- pure calculations (mirrored by public.shift_litres / _price_shift_reading in SQL) ----------

export type ReadingInput = { opening: number; closing: number | null; test: number; rollover: number | null };
export type ReadingIssue = "missing" | "belowOpening" | "aboveRollover" | "testExceeds" | null;

/** Litres sold = closing − opening − test litres. With a meter rollover the meter passed `rollover` and restarted at 0. */
export function litresSold(r: ReadingInput): number | null {
  if (r.closing === null) return null;
  const dispensed = r.rollover === null ? r.closing - r.opening : r.rollover - r.opening + r.closing;
  return round2(dispensed - (r.test || 0));
}

export function readingIssue(r: ReadingInput): ReadingIssue {
  if (r.closing === null) return "missing";
  if (r.rollover === null && r.closing < r.opening) return "belowOpening";
  if (r.rollover !== null && r.closing > r.rollover) return "aboveRollover";
  const l = litresSold(r);
  if (l !== null && l < 0) return "testExceeds";
  return null;
}

/** Price effective at the shift's price time — the latest effective_at not after it. */
export function priceAt(prices: FuelPrice[], productId: string, at: Date): FuelPrice | null {
  return (
    prices
      .filter((p) => p.product_id === productId && new Date(p.effective_at) <= at)
      .sort((a, b) => +new Date(b.effective_at) - +new Date(a.effective_at))[0] ?? null
  );
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const saleAmount = (litres: number, price: number) => round2(litres * price);

export type Collections = Record<CollectionField, number>;
export function reconcile(totalSales: number, c: Collections) {
  const collected = round2(COLLECTION_FIELDS.reduce((s, f) => s + (Number(c[f]) || 0), 0));
  const difference = round2(collected - totalSales);
  const status: "matched" | "short" | "excess" = Math.abs(difference) < 0.005 ? "matched" : difference < 0 ? "short" : "excess";
  return { collected, difference, status };
}

/** Parse a user-typed number; empty → null. */
export function parseNum(v: string): number | null {
  const s = v.replace(/,/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- queries ----------

export const shiftsQuery = (stationId: string, date: string | null) =>
  queryOptions({
    queryKey: ["shifts", stationId, date],
    queryFn: async () => {
      let q = supabase.from("shifts").select("*").eq("station_id", stationId);
      if (date) q = q.eq("shift_date", date);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

export const shiftQuery = (id: string) =>
  queryOptions({
    queryKey: ["shift", id],
    queryFn: async () => {
      const [s, r, c] = await Promise.all([
        supabase.from("shifts").select("*").eq("id", id).maybeSingle(),
        supabase.from("shift_readings").select("*").eq("shift_id", id),
        supabase.from("shift_corrections").select("*").eq("shift_id", id).order("created_at", { ascending: false }),
      ]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      if (c.error) throw c.error;
      return { shift: s.data, readings: r.data, corrections: c.data };
    },
  });

export const peopleQuery = (stationId: string) =>
  queryOptions({
    queryKey: ["station-people", stationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("station_people", { _station_id: stationId });
      if (error) throw error;
      return data;
    },
  });

export const todayKarachi = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());

export function shiftErrorKey(err: { message?: string } | null): TranslationKey {
  const m = err?.message ?? "";
  const map: [string, TranslationKey][] = [
    ["shift_already_closed", "shift.err.alreadyClosed"],
    ["shift_closed", "shift.err.alreadyClosed"],
    ["nozzle_in_open_shift", "shift.err.openExists"],
    ["no_nozzles", "shift.err.noNozzles"],
    ["no_price", "shift.err.noPrice"],
    ["closing_missing", "shift.err.missing"],
    ["closing_below_opening", "shift.err.belowOpening"],
    ["closing_above_rollover", "shift.err.aboveRollover"],
    ["rollover_below_opening", "shift.err.rolloverBelow"],
    ["test_exceeds_dispensed", "shift.err.testExceeds"],
    ["future_date", "shift.err.futureDate"],
    ["reason_required", "validation.reasonMin"],
    ["forbidden", "shift.err.forbidden"],
  ];
  return map.find(([k]) => m.includes(k))?.[1] ?? "setup.err.generic";
}
