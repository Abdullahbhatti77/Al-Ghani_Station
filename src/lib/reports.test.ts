import { describe, expect, it } from "vitest";
import { dailySales, salesBy, varianceTotals, deliveriesIn, expensesIn, presetRange, karachiDate } from "./reports";
import { toCSV } from "./finance";

const shift = (id: string, date: string, o: Partial<Record<string, number | string>> = {}) => ({
  id, shift_date: date, status: "closed", total_litres: 100, total_sales: 26550, total_collected: 26000, credit_sales: 500, difference: -50, cash_variance: 0, ...o,
}) as never;

const r = { from: "2026-10-01", to: "2026-10-31" };

describe("reports", () => {
  it("daily sales only count closed shifts inside the period", () => {
    const rows = dailySales([shift("a", "2026-10-02"), shift("b", "2026-10-02"), shift("c", "2026-09-30"), shift("d", "2026-10-03", { status: "draft" })], r);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-10-02", shifts: 2, litres: 200, sales: 53100 });
  });
  it("sales by product ignore readings of shifts outside the period", () => {
    const rd = [
      { shift_id: "a", nozzle_id: "n1", product_id: "p", litres_sold: 10, amount: 2655 },
      { shift_id: "c", nozzle_id: "n1", product_id: "p", litres_sold: 99, amount: 9999 },
    ];
    expect(salesBy("product_id", rd, [shift("a", "2026-10-02"), shift("c", "2026-09-01")], r)).toEqual([{ id: "p", litres: 10, amount: 2655 }]);
  });
  it("separates shortage and surplus", () => {
    const v = varianceTotals([shift("a", "2026-10-02", { difference: -100 }), shift("b", "2026-10-03", { difference: 30 })], r);
    expect(v).toMatchObject({ shortage: -100, surplus: 30, net: -70 });
  });
  it("reversed deliveries and expenses are excluded", () => {
    const d = deliveriesIn([
      { delivered_at: "2026-10-05T10:00:00Z", litres: 5000, invoice_amount: 1000000, reversed_at: null },
      { delivered_at: "2026-10-05T10:00:00Z", litres: 4000, invoice_amount: 800000, reversed_at: "2026-10-06T00:00:00Z" },
    ] as never, r);
    expect(d).toMatchObject({ litres: 5000, amount: 1000000 });
    const e = expensesIn([
      { occurred_at: "2026-10-05T10:00:00Z", amount: 1200, category_id: "c", reversed_at: null },
      { occurred_at: "2026-10-05T10:00:00Z", amount: 800, category_id: "c", reversed_at: "x" },
    ] as never, r);
    expect(e.total).toBe(1200);
  });
  it("uses Pakistan dates (late night UTC is next day in Karachi)", () => {
    expect(karachiDate("2026-10-31T20:00:00Z")).toBe("2026-11-01");
  });
  it("preset ranges", () => {
    expect(presetRange("yesterday", "2026-10-01")).toEqual({ from: "2026-09-30", to: "2026-09-30" });
    expect(presetRange("month", "2026-10-29")).toEqual({ from: "2026-10-01", to: "2026-10-29" });
    expect(presetRange("week", "2026-10-29")).toEqual({ from: "2026-10-23", to: "2026-10-29" });
  });
  it("CSV escapes commas and quotes", () => {
    expect(toCSV(["a"], [['Rana, "Transport"']])).toBe('a\n"Rana, ""Transport"""');
  });
});
