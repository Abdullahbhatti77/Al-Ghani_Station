import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/_app/shifts")({
  head: () => ({
    meta: [
      { title: "Shifts — PumpHisab" },
      { name: "description", content: "Shifts for your petrol station in PumpHisab." },
      { property: "og:title", content: "Shifts — PumpHisab" },
      { property: "og:description", content: "Shifts for your petrol station in PumpHisab." },
    ],
  }),
  component: ShiftsPage,
});

function ShiftsPage() {
  return <ModulePlaceholder titleKey="nav.shifts" descKey="module.shifts.desc" />;
}
