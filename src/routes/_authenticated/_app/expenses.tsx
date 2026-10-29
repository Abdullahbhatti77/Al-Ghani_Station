import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/_app/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — PumpHisab" },
      { name: "description", content: "Expenses for your petrol station in PumpHisab." },
      { property: "og:title", content: "Expenses — PumpHisab" },
      { property: "og:description", content: "Expenses for your petrol station in PumpHisab." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  return <ModulePlaceholder titleKey="nav.expenses" descKey="module.expenses.desc" />;
}
