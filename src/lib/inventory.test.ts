import { describe, expect, it } from "vitest";
import { breakdown, compareDip, defaultThreshold, deliveryAmount, invoiceMismatch, tankAlerts, withBalance, type StockMovement, type TankDip } from "./inventory";

let n = 0;
const mv = (kind: string, litres: number, at: string, tank = "A") =>
  ({ id: String(++n), tank_id: tank, kind, litres, occurred_at: at, created_at: at }) as unknown as StockMovement;
const dip = (litres: number, at: string) => ({ id: String(++n), measured_litres: litres, measured_at: at }) as unknown as TankDip;

const ledger = [
  mv("opening", 10000, "2026-10-01T00:00:00Z"),
  mv("delivery", 5000, "2026-10-02T00:00:00Z"),
  mv("sale", -3200, "2026-10-03T00:00:00Z"),
  mv("adjustment", -50, "2026-10-04T00:00:00Z"),
];

describe("stock ledger", () => {
  it("opening + deliveries − sales ± adjustments = expected", () => {
    expect(breakdown(ledger)).toEqual({ opening: 10000, deliveries: 5000, sales: 3200, adjustments: -50, expected: 11750 });
  });
  it("a reversed delivery cancels out instead of double counting", () => {
    const b = breakdown([...ledger, mv("delivery", 2000, "2026-10-05T00:00:00Z"), mv("delivery_reversal", -2000, "2026-10-06T00:00:00Z")]);
    expect(b.deliveries).toBe(5000);
    expect(b.expected).toBe(11750);
  });
  it("sale corrections adjust sales only by the difference", () => {
    expect(breakdown([...ledger, mv("sale_correction", -10, "2026-10-05T00:00:00Z")]).sales).toBe(3210);
  });
  it("decimals stay exact to the paisa/litre", () => {
    expect(breakdown([mv("opening", 0.1, "2026-10-01T00:00:00Z"), mv("delivery", 0.2, "2026-10-02T00:00:00Z")]).expected).toBe(0.3);
  });
  it("running balance follows time order", () => {
    expect(withBalance(ledger).map((m) => m.balance)).toEqual([10000, 15000, 11800, 11750]);
  });
  it("two tanks of the same fuel are counted separately", () => {
    const all = [...ledger, mv("opening", 7000, "2026-10-01T00:00:00Z", "B")];
    expect(breakdown(all.filter((m) => m.tank_id === "B")).expected).toBe(7000);
    expect(breakdown(all.filter((m) => m.tank_id === "A")).expected).toBe(11750);
  });
});

describe("dips", () => {
  it("compares the latest dip against expected stock at the dip time", () => {
    const c = compareDip(ledger, [dip(14900, "2026-10-02T12:00:00Z"), dip(11700, "2026-10-04T12:00:00Z")]);
    expect(c?.expectedAtDip).toBe(11750);
    expect(c?.difference).toBe(-50);
    expect(c?.status).toBe("below");
  });
  it("a dip never changes expected stock", () => {
    compareDip(ledger, [dip(9000, "2026-10-04T12:00:00Z")]);
    expect(breakdown(ledger).expected).toBe(11750);
  });
  it("no dip → no comparison", () => {
    expect(compareDip(ledger, [])).toBeNull();
  });
});

describe("alerts", () => {
  const tank = { capacity_litres: 20000, low_stock_litres: 3000 };
  it("default threshold is 0.5% of capacity, minimum 50 L", () => {
    expect(defaultThreshold(20000)).toBe(100);
    expect(defaultThreshold(5000)).toBe(50);
  });
  it("flags low, negative, over capacity and big variance", () => {
    expect(tankAlerts(tank, 2000, null, null)).toEqual(["low"]);
    expect(tankAlerts(tank, -5, null, null)).toEqual(["negative"]);
    expect(tankAlerts(tank, 20500, null, null)).toEqual(["overCapacity"]);
    const c = compareDip(ledger, [dip(11500, "2026-10-04T12:00:00Z")]);
    expect(tankAlerts(tank, 11750, c, null)).toEqual(["variance"]);
    expect(tankAlerts(tank, 11750, c, 500)).toEqual([]);
  });
});

describe("deliveries", () => {
  it("amount = litres × rate, mismatch flagged against invoice", () => {
    expect(deliveryAmount(5000, 255.43)).toBe(1277150);
    expect(invoiceMismatch(5000, 255.43, 1277150)).toBe(false);
    expect(invoiceMismatch(5000, 255.43, 1277000)).toBe(true);
  });
});
