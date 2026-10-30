import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, CreditCard, HandCoins, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { useStationCtx } from "@/components/setup/shared";
import { CreditSaleDialog, CustomerDialog, PaymentDialog, ReverseButton, useCustomers } from "@/components/finance/dialogs";
import { DateRange, inRange, StatementActions, StatementTable } from "@/components/finance/statement";
import { useT, type TranslationKey } from "@/lib/i18n";
import { formatPKR, productsQuery } from "@/lib/setup";
import { customerLedger, downloadCSV, toCSV } from "@/lib/finance";
import { myStationQuery } from "@/lib/station";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/customers_/$customerId")({
  head: () => ({
    meta: [
      { title: "Customer ledger — Al-Ghani Station" },
      { name: "description", content: "Udhaar ledger with credit sales, repayments and running balance." },
      { property: "og:title", content: "Customer ledger — Al-Ghani Station" },
      { property: "og:description", content: "Udhaar ledger with credit sales, repayments and running balance." },
    ],
  }),
  component: CustomerPage,
});

function CustomerPage() {
  const t = useT();
  const { customerId } = Route.useParams();
  const { stationId, canEdit } = useStationCtx();
  const { data: me } = useSuspenseQuery(myStationQuery);
  const { customers, txns, balances } = useCustomers(stationId);
  const { data: products } = useSuspenseQuery(productsQuery(stationId));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [d, setD] = useState<"edit" | "sale" | "pay" | null>(null);
  const c = customers.find((x) => x.id === customerId);
  if (!c) return <EmptyState title={t("fin.cust.notFound")} action={<Button asChild><Link to="/customers">{t("common.back")}</Link></Button>} />;

  const ledger = customerLedger(Number(c.opening_balance), txns.filter((x) => x.customer_id === c.id));
  const visible = ledger.filter((r) => inRange(r.occurred_at, from, to));
  const before = ledger.filter((r) => from && r.occurred_at.slice(0, 10) < from);
  const opening = before.length ? before[before.length - 1]!.balance : Number(c.opening_balance);
  const desc = (r: (typeof ledger)[number]) => {
    const base = r.kind === "credit_sale"
      ? `${t("fin.k.credit_sale")}: ${products.find((p) => p.id === r.product_id)?.name ?? ""} ${r.litres} L @ ${formatPKR(Number(r.rate))}${r.vehicle ? ` · ${r.vehicle}` : ""}`
      : `${t("fin.k.payment")} (${t(`fin.m.${r.method}` as TranslationKey)})`;
    return `${base}${r.over_limit ? ` · ${t("fin.overLimitApproved")}: ${r.approval_reason}` : ""}${r.reversed_at ? ` · ${t("fin.reversedNote")}: ${r.reversal_reason}` : ""}`;
  };
  const bal = balances.get(c.id) ?? 0;

  const csv = () => downloadCSV(`${c.name}-ledger.csv`, toCSV(
    [t("fin.date"), t("fin.reference"), t("fin.description"), t("fin.debit"), t("fin.credit"), t("fin.balance")],
    visible.map((r) => [r.occurred_at.slice(0, 16).replace("T", " "), r.reference ?? "", desc(r), r.debit || "", r.credit || "", r.balance]),
  ));

  return (
    <>
      <div className="print:hidden">
        <Button asChild variant="ghost" className="mb-2 h-10"><Link to="/customers"><ChevronLeft className="h-4 w-4" aria-hidden />{t("nav.customers")}</Link></Button>
      </div>
      <PageHeader title={c.name} description={[c.business_name, c.phone, c.address].filter(Boolean).join(" · ")}
        actions={canEdit ? <Button variant="outline" className="h-11 print:hidden" onClick={() => setD("edit")}><Pencil className="h-4 w-4" aria-hidden />{t("setup.edit")}</Button> : undefined} />
      <p className="mb-4 hidden text-sm print:block">{me!.station.name} · {t("fin.statement")} · {new Date().toLocaleDateString("en-PK")}</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-primary bg-card p-5 sm:col-span-1">
          <p className="text-sm text-muted-foreground">{t("fin.currentBalance")}</p>
          <p className="font-display text-4xl font-bold tabular-nums">{formatPKR(bal)}</p>
          {c.credit_limit !== null && bal > Number(c.credit_limit) && <Badge variant="destructive" className="mt-2">{t("fin.overLimitBadge")}</Badge>}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t("fin.cust.limit")}</p>
          <p className="font-display text-2xl font-bold tabular-nums">{c.credit_limit === null ? t("fin.noLimit") : formatPKR(Number(c.credit_limit))}</p>
          {c.vehicles.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{c.vehicles.join(", ")}</p>}
        </div>
        <div className="grid gap-2 print:hidden">
          <Button className="h-12" onClick={() => setD("sale")} disabled={!c.is_active}><CreditCard className="h-4 w-4" aria-hidden />{t("fin.qa.creditSale")}</Button>
          <Button variant="outline" className="h-12" onClick={() => setD("pay")}><HandCoins className="h-4 w-4" aria-hidden />{t("fin.qa.receivePayment")}</Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <StatementActions onCsv={csv} />
      </div>
      <StatementTable opening={opening} debitLabel={t("fin.debit")} creditLabel={t("fin.credit")}
        rows={visible.map((r) => ({
          id: r.id, at: r.occurred_at, reference: r.reference ?? "", description: desc(r), debit: r.debit, credit: r.credit, balance: r.balance, reversed: !!r.reversed_at,
          action: canEdit && !r.reversed_at ? <ReverseButton onReverse={(reason) => supabase.rpc("reverse_customer_txn", { _txn_id: r.id, _reason: reason })} /> : undefined,
        }))} />
      {c.notes && <p className="mt-4 text-sm text-muted-foreground">{c.notes}</p>}

      {d === "edit" && <CustomerDialog customer={c} onClose={() => setD(null)} />}
      {d === "sale" && <CreditSaleDialog customerId={c.id} onClose={() => setD(null)} />}
      {d === "pay" && <PaymentDialog customerId={c.id} onClose={() => setD(null)} />}
    </>
  );
}
