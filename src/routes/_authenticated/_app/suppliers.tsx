import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Banknote, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { ListToolbar, useStationCtx } from "@/components/setup/shared";
import { PaySupplierDialog } from "@/components/finance/dialogs";
import { ReceiveFuelDialog } from "@/components/inventory/dialogs";
import { useT } from "@/lib/i18n";
import { formatPKR, suppliersQuery } from "@/lib/setup";
import { deliveriesQuery } from "@/lib/inventory";
import { supplierOutstanding, supplierPaymentsQuery } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/_app/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers & Payables — PumpHisab" },
      { name: "description", content: "Supplier purchases from fuel deliveries, payments made and outstanding payables." },
      { property: "og:title", content: "Suppliers & Payables — PumpHisab" },
      { property: "og:description", content: "Supplier purchases from fuel deliveries, payments made and outstanding payables." },
    ],
  }),
  component: SuppliersPage,
});

export function useSupplierTotals(stationId: string) {
  const [s, d, p] = useSuspenseQueries({ queries: [suppliersQuery(stationId), deliveriesQuery(stationId), supplierPaymentsQuery(stationId)] });
  const totals = (id: string) => {
    const sup = s.data.find((x) => x.id === id)!;
    return supplierOutstanding(Number(sup.opening_payable), d.data.filter((x) => x.supplier_id === id), p.data.filter((x) => x.supplier_id === id));
  };
  return { suppliers: s.data, deliveries: d.data, payments: p.data, totals };
}

function SuppliersPage() {
  const t = useT();
  const { stationId, canEdit } = useStationCtx();
  const { suppliers, totals } = useSupplierTotals(stationId);
  const [q, setQ] = useState("");
  const [d, setD] = useState<"pay" | "receive" | null>(null);
  const s = q.trim().toLowerCase();
  const rows = suppliers.filter((x) => x.is_active && (!s || [x.business_name, x.contact_person, x.phone].some((v) => v?.toLowerCase().includes(s))));
  const grand = suppliers.reduce((a, x) => a + totals(x.id).outstanding, 0);

  return (
    <>
      <PageHeader title={t("nav.suppliers")} description={t("fin.sup.desc")} />
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        {canEdit && <Button size="lg" className="h-14 text-base" onClick={() => setD("receive")}><Truck className="h-5 w-5" aria-hidden />{t("inv.receive")}</Button>}
        {canEdit && <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setD("pay")} disabled={!suppliers.length}><Banknote className="h-5 w-5" aria-hidden />{t("fin.qa.paySupplier")}</Button>}
        <Button asChild size="lg" variant="ghost" className="h-14 text-base"><Link to="/setup" search={{ step: "suppliers" }}>{t("fin.sup.manage")}</Link></Button>
      </div>
      {suppliers.length > 0 && (
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">{t("fin.sup.totalPayable")}</p>
          <p className="font-display text-3xl font-bold tabular-nums">{formatPKR(grand)}</p>
        </div>
      )}
      <ListToolbar search={q} onSearch={setQ} onAdd={() => undefined} addLabel="" canEdit={false} />
      <DataTable
        rows={rows}
        rowKey={(x) => x.id}
        empty={<EmptyState title={t("supplier.empty")} />}
        columns={[
          { key: "n", header: t("supplier.name"), cell: (x) => <Link to="/suppliers/$supplierId" params={{ supplierId: x.id }} className="font-semibold text-primary hover:underline">{x.business_name}</Link> },
          { key: "pu", header: t("fin.sup.purchases"), className: "text-right", cell: (x) => <span className="tabular-nums">{formatPKR(totals(x.id).purchases)}</span> },
          { key: "pa", header: t("fin.sup.payments"), className: "text-right", cell: (x) => <span className="tabular-nums">{formatPKR(totals(x.id).paid)}</span> },
          { key: "o", header: t("fin.outstanding"), className: "text-right", cell: (x) => <span className="text-lg font-bold tabular-nums">{formatPKR(totals(x.id).outstanding)}</span> },
        ]}
      />
      {d === "pay" && <PaySupplierDialog outstanding={(id) => totals(id).outstanding} onClose={() => setD(null)} />}
      {d === "receive" && <ReceiveFuelDialog onClose={() => setD(null)} />}
    </>
  );
}
