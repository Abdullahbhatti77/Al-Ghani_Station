import type { StationRole } from "@/lib/station";

/** UI mirror of backend rules (RLS, security-definer RPCs, guard_staff_writes trigger). The backend is the real enforcement. */
export type Permission =
  | "station.settings" // station profile, thresholds
  | "prices.set"
  | "staff.manage"
  | "setup.edit" // products, tanks, nozzles, suppliers, customers, categories
  | "reports.view"
  | "history.view"
  | "records.reverse"
  | "approvals" // stock adjustments, over-limit credit, variances, corrections
  | "deliveries.record"
  | "suppliers.pay"
  | "shifts.any"; // work on shifts assigned to someone else

const MATRIX: Record<StationRole, Permission[]> = {
  owner: ["station.settings", "prices.set", "staff.manage", "setup.edit", "reports.view", "history.view", "records.reverse", "approvals", "deliveries.record", "suppliers.pay", "shifts.any"],
  manager: ["setup.edit", "reports.view", "history.view", "records.reverse", "approvals", "deliveries.record", "suppliers.pay", "shifts.any"],
  staff: [],
};

export const can = (role: StationRole, p: Permission) => MATRIX[role].includes(p);
