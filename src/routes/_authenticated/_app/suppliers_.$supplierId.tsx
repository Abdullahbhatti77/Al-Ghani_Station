import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Banknote, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { useStationCtx } from "@/components/setup/shared";
import { PaySupplierDialog, ReverseButton } from "@/components/finance/dialogs";
import { DateRange, inRange, StatementActions, StatementTable, type StatementRow } from "@/components/finance/statement";
import { useT, type TranslationKey } from "@/lib/i18n";
import { formatPKR, suppliersQuery } from "@/lib/setup";
import { deliveriesQuery } from "@/lib/inventory";
import { downloadCSV, supplierOutstanding, supplierPaymentsQuery, toCSV } from "@/lib/finance";
import { round2 } from "@/lib/shifts";
import { myStationQuery } from "@/lib/station";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/suppliers_/$supplierId")({
  head: () => ({
    meta: [
      { title: "Supplier statement — PumpHisab" },
      { name: "description", content: "Delivery invoices, payments and outstanding payable for a supplier." },
      { property: "og:title", content: "Supplier statement — PumpHisab" },
      { property: "og:description", content: "Delivery invoices, payments and outstanding payable for a supplier." },
    ],
  }),
  component: SupplierPage,
});

function SupplierPage() {
  const t = useT();
  const { supplierId } = Route.useParams();
  const { stationId, canEdit } = useStationCtx();
  const { data: me } = useSuspenseQuery(myStationQuery);
  const [s, d, p] = useSuspenseQueries({ queries: [suppliersQuery(stationId), deliveriesQuery(stationId), supplierPaymentsQuery(stationId)] });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pay, setPay] = useState(false);
  const sup = s.data.find((x) => x.id === supplierId);
  if (!sup) return <EmptyState title={t("fin.sup.notFound")} action={<Button asChild><Link to="/suppliers">{t("common.back")}</Link></Button>} />;

  const dels = d.data.filter((x) => x.supplier_id === sup.id);
  const pays = p.data.filter((x) => x.supplier_id === sup.id);
  const tot = supplierOutstanding(Number(sup.opening_payable), dels, pays);
  type E = Omit<StatementRow, "balance">;
  const entries: E[] = [
    ...dels.map((x) => ({ id: x.id, at: x.delivered_at, reference: x.challan_no, debit: 0, credit: x.reversed_at ? 0 : Number(x.invoice_amount), reversed: !!x.reversed_at,
      description: `${t("fin.sup.invoice")}: ${Number(x.litres)} L @ ${formatPKR(Number(x.rate_per_litre))}${x.reversed_at ? ` · ${t("fin.reversedNote")}: ${x.reversal_reason}` : ""}` })),
    ...pays.map((x) => ({ id: x.id, at: x.paid_at, reference: x.reference ?? "", credit: 0, debit: x.reversed_at ? 0 : Number(x.amount), reversed: !!x.reversed_at,
      description: `${t("fin.sup.payment")} (${t(`fin.m.${x.method}` as TranslationKey)})${x.notes ? ` · ${x.notes}` : ""}${x.reversed_at ? ` · ${t("fin.reversedNote")}: ${x.reversal_reason}` : ""}`,
      action: canEdit && !x.reversed_at ? <ReverseButton onReverse={(r) => supabase.rpc("reverse_supplier_payment", { _payment_id: x.id, _reason: r })} /> : undefined })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  let bal = Number(sup.opening_payable);
  const all = entries.map((e) => ({ ...e, balance: (bal = round2(bal + e.credit - e.debit)) }));
  const visible = all.filter((r) => inRange(r.at, from, to));
  const before = all.filter((r) => from && r.at.slice(0, 10) < from);
  const opening = before.length ? before[before.length - 1]!.balance : Number(sup.opening_payable);

  const csv = () => downloadCSV(`${sup.business_name}-statement.csv`, toCSV(
    [t("fin.date"), t("fin.reference"), t("fin.description"), t("fin.sup.paid"), t("fin.sup.billed"), t("fin.balance")],
    visible.map((r) => [r.at.slice(0, 16).replace("T", " "), r.reference, r.description, r.debit || "", r.credit || "", r.balance]),
  ));

  return (
    <>
      <div className="print:hidden"><Button asChild variant="ghost" className="mb-2 h-10"><Link to="/suppliers"><ChevronLeft className="h-4 w-4" aria-hidden />{t("nav.suppliers")}</Link></Button></div>
      <PageHeader title={sup.business_name} description={[sup.contact_person, sup.phone].filter(Boolean).join(" · ")}
        actions={canEdit ? <Button className="h-11 print:hidden" onClick={() => setPay(true)}><Banknote className="h-4 w-4" aria-hidden />{t("fin.qa.paySupplier")}</Button> : undefined} />
      <p className="mb-4 hidden text-sm print:block">{me!.station.name} · {t("fin.statement")} · {new Date().toLocaleDateString("en-PK")}</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Tile label={t("fin.sup.purchases")} v={tot.purchases} />
        <Tile label={t("fin.sup.payments")} v={tot.paid} />
        <Tile label={t("fin.outstanding")} v={tot.outstanding} strong />
      </div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <StatementActions onCsv={csv} />
      </div>
      <StatementTable rows={visible} opening={opening} debitLabel={t("fin.sup.paid")} creditLabel={t("fin.sup.billed")} />
      {pay && <PaySupplierDialog supplierId={sup.id} outstanding={() => tot.outstanding} onClose={() => setPay(false)} />}
    </>
  );
}

function Tile({ label, v, strong }: { label: string; v: number; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-xl border-2 border-primary bg-card p-5" : "rounded-xl border bg-card p-5"}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold tabular-nums">{formatPKR(v)}</p>
    </div>
  );
}
