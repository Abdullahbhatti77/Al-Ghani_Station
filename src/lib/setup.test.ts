import { describe, expect, it } from "vitest";
import { currentPrice, nozzleSchema, priceSchema, setupStatus, stockCorrectionSchema, tankSchema, type FuelPrice } from "./setup";

const pid = "11111111-1111-4111-8111-111111111111";

describe("tank rules", () => {
  const base = { name: "Tank 1", product_id: pid, capacity_litres: 25000, low_stock_litres: 3000 };
  it("rejects opening stock above capacity", () => {
    expect(tankSchema.safeParse({ ...base, opening_stock_litres: 25001 }).success).toBe(false);
  });
  it("rejects negative stock", () => {
    expect(tankSchema.safeParse({ ...base, opening_stock_litres: -1 }).success).toBe(false);
  });
  it("accepts stock equal to capacity", () => {
    expect(tankSchema.safeParse({ ...base, opening_stock_litres: 25000 }).success).toBe(true);
  });
  it("correction needs a reason and stays within capacity", () => {
    const s = stockCorrectionSchema(1000);
    expect(s.safeParse({ new_litres: 1001, reason: "dip" }).success).toBe(false);
    expect(s.safeParse({ new_litres: 500, reason: "" }).success).toBe(false);
    expect(s.safeParse({ new_litres: 500, reason: "fresh dip" }).success).toBe(true);
  });
});

describe("price rules", () => {
  it("price must be greater than 0", () => {
    expect(priceSchema.safeParse({ product_id: pid, price_per_litre: 0, effective_at: "2026-11-01T00:00" }).success).toBe(false);
  });
  it("current price is the latest effective one; history is kept", () => {
    const mk = (id: string, price: number, at: string) => ({ id, product_id: pid, price_per_litre: price, effective_at: at }) as FuelPrice;
    const prices = [mk("a", 250, "2026-10-01T00:00:00Z"), mk("b", 265.5, "2026-10-16T00:00:00Z"), mk("c", 270, "2026-11-01T00:00:00Z")];
    expect(currentPrice(prices, pid, new Date("2026-10-29T00:00:00Z"))?.id).toBe("b");
    expect(currentPrice(prices, pid, new Date("2026-11-02T00:00:00Z"))?.id).toBe("c");
  });
});

describe("nozzle rules", () => {
  it("nozzle number must be a whole number", () => {
    expect(nozzleSchema.safeParse({ number: 1.5, display_name: "N", product_id: pid, tank_id: pid, meter_reading: 0 }).success).toBe(false);
  });
});

describe("setup status", () => {
  it("prices step is done only when every active fuel has a price", () => {
    const p = (id: string) => ({ id, is_active: true, is_fuel: true }) as never;
    const status = setupStatus({ products: [p("x"), p("y")], tanks: [], nozzles: [], suppliers: [], prices: [{ product_id: "x" } as never] });
    expect(status.prices).toBe(false);
  });
});
