import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, HandCoins, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { ListToolbar, useStationCtx } from "@/components/setup/shared";
import { CreditSaleDialog, CustomerDialog, PaymentDialog, useCustomers } from "@/components/finance/dialogs";
import { useT } from "@/lib/i18n";
import { formatPKR } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/_app/customers")({
  head: () => ({
    meta: [
      { title: "Customers & Udhaar — PumpHisab" },
      { name: "description", content: "Credit customers, udhaar balances, credit sales and repayments for your station." },
      { property: "og:title", content: "Customers & Udhaar — PumpHisab" },
      { property: "og:description", content: "Credit customers, udhaar balances, credit sales and repayments for your station." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const t = useT();
  const { stationId, canEdit } = useStationCtx();
  const { customers, balances } = useCustomers(stationId);
  const [q, setQ] = useState("");
  const [arch, setArch] = useState(false);
  const [d, setD] = useState<"add" | "sale" | "pay" | null>(null);
  const s = q.trim().toLowerCase();
  const rows = customers.filter((c) => (arch || c.is_active) && (!s || [c.name, c.business_name, c.phone, ...c.vehicles].some((x) => x?.toLowerCase().includes(s))));
  const total = customers.length ? [...balances.values()].reduce((a, b) => a + b, 0) : null;

  return (
    <>
      <PageHeader title={t("nav.customers")} description={t("module.customers.desc")} />
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        <Button size="lg" className="h-14 text-base" onClick={() => setD("sale")} disabled={!customers.length}><CreditCard className="h-5 w-5" aria-hidden />{t("fin.qa.creditSale")}</Button>
        <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setD("pay")} disabled={!customers.length}><HandCoins className="h-5 w-5" aria-hidden />{t("fin.qa.receivePayment")}</Button>
        {canEdit && <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setD("add")}><UserPlus className="h-5 w-5" aria-hidden />{t("fin.qa.addCustomer")}</Button>}
      </div>
      {total !== null && (
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">{t("dashboard.udhaar")}</p>
          <p className="font-display text-3xl font-bold tabular-nums">{formatPKR(total)}</p>
        </div>
      )}
      <ListToolbar search={q} onSearch={setQ} showArchived={arch} onShowArchived={setArch} onAdd={() => setD("add")} addLabel={t("fin.qa.addCustomer")} canEdit={false} />
      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        empty={<EmptyState title={t("fin.cust.empty")} />}
        columns={[
          { key: "n", header: t("fin.cust.name"), cell: (c) => <Link to="/customers/$customerId" params={{ customerId: c.id }} className="font-semibold text-primary underline-offset-2 hover:underline">{c.name}{c.business_name && <span className="block text-xs font-normal text-muted-foreground">{c.business_name}</span>}</Link> },
          { key: "p", header: t("fin.cust.phone"), cell: (c) => c.phone ?? "—" },
          { key: "v", header: t("fin.cust.vehicles"), cell: (c) => c.vehicles.join(", ") || "—" },
          { key: "l", header: t("fin.cust.limit"), className: "text-right", cell: (c) => <span className="tabular-nums">{c.credit_limit === null ? t("fin.noLimit") : formatPKR(Number(c.credit_limit))}</span> },
          { key: "b", header: t("fin.currentBalance"), className: "text-right", cell: (c) => {
            const b = balances.get(c.id) ?? 0;
            const over = c.credit_limit !== null && b > Number(c.credit_limit);
            return <span className="text-lg font-bold tabular-nums">{formatPKR(b)}{over && <Badge variant="destructive" className="ml-2">{t("fin.overLimitBadge")}</Badge>}{!c.is_active && <Badge variant="secondary" className="ml-2">{t("setup.archived")}</Badge>}</span>;
          } },
        ]}
      />
      {d === "add" && <CustomerDialog onClose={() => setD(null)} />}
      {d === "sale" && <CreditSaleDialog onClose={() => setD(null)} />}
      {d === "pay" && <PaymentDialog onClose={() => setD(null)} />}
    </>
  );
}
