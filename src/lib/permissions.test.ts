import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("role permissions", () => {
  it("only owners set prices, manage staff and station settings", () => {
    for (const p of ["prices.set", "staff.manage", "station.settings"] as const) {
      expect(can("owner", p)).toBe(true);
      expect(can("manager", p)).toBe(false);
      expect(can("staff", p)).toBe(false);
    }
  });
  it("managers approve, reverse and run reports", () => {
    for (const p of ["approvals", "records.reverse", "reports.view", "history.view"] as const) expect(can("manager", p)).toBe(true);
  });
  it("attendants cannot approve, reverse, view reports or record deliveries", () => {
    for (const p of ["approvals", "records.reverse", "reports.view", "deliveries.record", "shifts.any", "suppliers.pay"] as const) expect(can("staff", p)).toBe(false);
  });
});
