import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/lib/i18n";

type T = Database["public"]["Tables"];
export type Product = T["products"]["Row"];
export type Tank = T["tanks"]["Row"];
export type Nozzle = T["nozzles"]["Row"];
export type FuelPrice = T["fuel_prices"]["Row"];
export type Supplier = T["suppliers"]["Row"];

async function list<R>(table: keyof T, stationId: string, order: string, asc = true): Promise<R[]> {
  const { data, error } = await supabase.from(table).select("*").eq("station_id", stationId).order(order, { ascending: asc });
  if (error) throw error;
  return data as R[];
}

export const productsQuery = (s: string) => queryOptions({ queryKey: ["products", s], queryFn: () => list<Product>("products", s, "created_at") });
export const tanksQuery = (s: string) => queryOptions({ queryKey: ["tanks", s], queryFn: () => list<Tank>("tanks", s, "name") });
export const nozzlesQuery = (s: string) => queryOptions({ queryKey: ["nozzles", s], queryFn: () => list<Nozzle>("nozzles", s, "number") });
export const pricesQuery = (s: string) => queryOptions({ queryKey: ["fuel_prices", s], queryFn: () => list<FuelPrice>("fuel_prices", s, "effective_at", false) });
export const suppliersQuery = (s: string) => queryOptions({ queryKey: ["suppliers", s], queryFn: () => list<Supplier>("suppliers", s, "business_name") });

/** Latest price whose effective time has passed. Prices are never overwritten. */
export function currentPrice(prices: FuelPrice[], productId: string, now = new Date()): FuelPrice | null {
  return (
    prices
      .filter((p) => p.product_id === productId && new Date(p.effective_at) <= now)
      .sort((a, b) => +new Date(b.effective_at) - +new Date(a.effective_at))[0] ?? null
  );
}

export type SetupStatus = { products: boolean; tanks: boolean; nozzles: boolean; prices: boolean; suppliers: boolean };
export function setupStatus(d: { products: Product[]; tanks: Tank[]; nozzles: Nozzle[]; prices: FuelPrice[]; suppliers: Supplier[] }): SetupStatus {
  const fuels = d.products.filter((p) => p.is_active && p.is_fuel);
  return {
    products: fuels.length > 0,
    tanks: d.tanks.some((t) => t.is_active),
    nozzles: d.nozzles.some((n) => n.is_active),
    prices: fuels.length > 0 && fuels.every((p) => d.prices.some((x) => x.product_id === p.id)),
    suppliers: d.suppliers.some((s) => s.is_active),
  };
}

/** Map database error messages to friendly translation keys. */
export function dbErrorKey(err: { message?: string; code?: string } | null): TranslationKey {
  const m = err?.message ?? "";
  if (err?.code === "23505") return "setup.err.duplicate";
  if (m.includes("nozzle_tank_product_mismatch")) return "setup.err.mismatch";
  if (m.includes("stock_out_of_range") || m.includes("opening_stock")) return "setup.err.stockRange";
  if (m.includes("tank_has_nozzles")) return "setup.err.tankHasNozzles";
  return "setup.err.generic";
}

// ---------- form schemas (messages are translation keys) ----------
const num = (msg: TranslationKey = "validation.number") =>
  z.coerce.number({ invalid_type_error: msg }).refine((n) => Number.isFinite(n), msg);

export const productSchema = z.object({
  name: z.string().trim().min(2, "validation.min2").max(80),
  code: z.string().trim().min(1, "validation.required").max(12),
  unit: z.enum(["litre", "kg", "piece"]),
  is_fuel: z.boolean(),
});

export const tankSchema = z
  .object({
    name: z.string().trim().min(1, "validation.required").max(60),
    product_id: z.string().uuid("validation.selectOne"),
    capacity_litres: num().refine((n) => n > 0, "validation.positive"),
    opening_stock_litres: num().refine((n) => n >= 0, "validation.nonNegative"),
    low_stock_litres: num().refine((n) => n >= 0, "validation.nonNegative"),
  })
  .refine((v) => v.opening_stock_litres <= v.capacity_litres, { path: ["opening_stock_litres"], message: "validation.stockOverCapacity" })
  .refine((v) => v.low_stock_litres <= v.capacity_litres, { path: ["low_stock_litres"], message: "validation.lowOverCapacity" });

export const stockCorrectionSchema = (capacity: number) =>
  z.object({
    new_litres: num()
      .refine((n) => n >= 0, "validation.nonNegative")
      .refine((n) => n <= capacity, "validation.stockOverCapacity"),
    reason: z.string().trim().min(3, "validation.reasonMin").max(300),
  });

export const nozzleSchema = z.object({
  number: num().refine((n) => Number.isInteger(n) && n > 0 && n < 1000, "validation.wholeNumber"),
  display_name: z.string().trim().min(1, "validation.required").max(60),
  product_id: z.string().uuid("validation.selectOne"),
  tank_id: z.string().uuid("validation.selectOne"),
  meter_reading: num().refine((n) => n >= 0, "validation.nonNegative"),
});

export const priceSchema = z.object({
  product_id: z.string().uuid("validation.selectOne"),
  price_per_litre: num().refine((n) => n > 0 && n < 100000, "validation.positive"),
  effective_at: z.string().min(1, "validation.required"),
  note: z.string().max(200).optional(),
});

export const supplierSchema = z.object({
  business_name: z.string().trim().min(2, "validation.min2").max(120),
  contact_person: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).refine((v) => v === "" || /^\+?[0-9][0-9\s-]{6,18}$/.test(v), "validation.phone").optional(),
  address: z.string().trim().max(300).optional(),
  opening_payable: num().refine((n) => n >= 0, "validation.nonNegative"),
  notes: z.string().trim().max(1000).optional(),
});

export const formatNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
export const formatPKR = (n: number) => `Rs ${formatNumber(n, 2)}`;
