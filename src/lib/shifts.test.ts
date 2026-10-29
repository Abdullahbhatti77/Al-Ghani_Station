import { describe, expect, it } from "vitest";
import { litresSold, priceAt, readingIssue, reconcile, saleAmount } from "./shifts";
import type { FuelPrice } from "./setup";

const price = (id: string, product: string, p: number, at: string) =>
  ({ id, product_id: product, price_per_litre: p, effective_at: at }) as unknown as FuelPrice;

describe("shift calculations", () => {
  it("litres = closing − opening − test litres", () => {
    expect(litresSold({ opening: 12500.5, closing: 13020.75, test: 5, rollover: null })).toBe(515.25);
  });
  it("meter not starting at zero is respected", () => {
    expect(litresSold({ opening: 998000, closing: 998100, test: 0, rollover: null })).toBe(100);
  });
  it("empty closing reading gives no sale and is flagged missing", () => {
    expect(litresSold({ opening: 100, closing: null, test: 0, rollover: null })).toBeNull();
    expect(readingIssue({ opening: 100, closing: null, test: 0, rollover: null })).toBe("missing");
  });
  it("closing below opening is flagged, never a negative sale", () => {
    expect(readingIssue({ opening: 500, closing: 400, test: 0, rollover: null })).toBe("belowOpening");
  });
  it("rollover counts litres past the meter max", () => {
    const r = { opening: 999900, closing: 50, test: 0, rollover: 1000000 };
    expect(readingIssue(r)).toBeNull();
    expect(litresSold(r)).toBe(150);
  });
  it("test litres larger than dispensed is flagged", () => {
    expect(readingIssue({ opening: 100, closing: 105, test: 10, rollover: null })).toBe("testExceeds");
  });
  it("uses the price effective at the shift time, not the newest", () => {
    const ps = [price("a", "p", 250, "2026-01-01T00:00:00Z"), price("b", "p", 270, "2026-02-01T00:00:00Z")];
    expect(priceAt(ps, "p", new Date("2026-01-15T00:00:00Z"))?.id).toBe("a");
    expect(priceAt(ps, "p", new Date("2026-02-15T00:00:00Z"))?.id).toBe("b");
    expect(priceAt(ps, "p", new Date("2025-12-01T00:00:00Z"))).toBeNull();
  });
  it("amount is litres × rate rounded to paisa", () => {
    expect(saleAmount(515.25, 272.89)).toBe(140606.57);
  });
  it("reconciliation reports short / excess / matched without changing values", () => {
    const c = { cash_received: 1000, bank_received: 500, card_received: 0, wallet_received: 200, other_received: 0 };
    expect(reconcile(1700, c)).toEqual({ collected: 1700, difference: 0, status: "matched" });
    expect(reconcile(2000, c)).toEqual({ collected: 1700, difference: -300, status: "short" });
    expect(reconcile(1500, c).status).toBe("excess");
  });
});
