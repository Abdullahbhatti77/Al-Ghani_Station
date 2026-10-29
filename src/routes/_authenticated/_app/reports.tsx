import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — PumpHisab" },
      { name: "description", content: "Reports for your petrol station in PumpHisab." },
      { property: "og:title", content: "Reports — PumpHisab" },
      { property: "og:description", content: "Reports for your petrol station in PumpHisab." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return <ModulePlaceholder titleKey="nav.reports" descKey="module.reports.desc" />;
}
