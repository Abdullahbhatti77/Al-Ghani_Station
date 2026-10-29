import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/_app/customers")({
  head: () => ({
    meta: [
      { title: "Customers & Udhaar — PumpHisab" },
      { name: "description", content: "Customers & Udhaar for your petrol station in PumpHisab." },
      { property: "og:title", content: "Customers & Udhaar — PumpHisab" },
      { property: "og:description", content: "Customers & Udhaar for your petrol station in PumpHisab." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  return <ModulePlaceholder titleKey="nav.customers" descKey="module.customers.desc" />;
}
