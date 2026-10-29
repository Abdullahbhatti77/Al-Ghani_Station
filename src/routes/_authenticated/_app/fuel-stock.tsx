import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/_app/fuel-stock")({
  head: () => ({
    meta: [
      { title: "Fuel Stock — PumpHisab" },
      { name: "description", content: "Fuel Stock for your petrol station in PumpHisab." },
      { property: "og:title", content: "Fuel Stock — PumpHisab" },
      { property: "og:description", content: "Fuel Stock for your petrol station in PumpHisab." },
    ],
  }),
  component: FuelStockPage,
});

function FuelStockPage() {
  return <ModulePlaceholder titleKey="nav.fuelStock" descKey="module.fuelStock.desc" />;
}
