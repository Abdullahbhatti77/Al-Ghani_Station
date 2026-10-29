import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/_app/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — PumpHisab" },
      { name: "description", content: "Suppliers for your petrol station in PumpHisab." },
      { property: "og:title", content: "Suppliers — PumpHisab" },
      { property: "og:description", content: "Suppliers for your petrol station in PumpHisab." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  return <ModulePlaceholder titleKey="nav.suppliers" descKey="module.suppliers.desc" />;
}
