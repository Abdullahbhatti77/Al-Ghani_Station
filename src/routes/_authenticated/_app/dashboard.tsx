import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { PageHeader, StatCard } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSetupData, type SetupStep } from "@/components/setup/use-setup-status";
import { useT, type TranslationKey } from "@/lib/i18n";
import { myStationQuery } from "@/lib/station";
import { useState } from "react";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Banknote, CreditCard, HandCoins, Plus, Truck, UserPlus } from "lucide-react";
import { formatPKR } from "@/lib/setup";
import { customersQuery, customerTxnsQuery, customerBalance, expensesQuery } from "@/lib/finance";
import { round2, shiftsQuery, todayKarachi } from "@/lib/shifts";
import { openShiftsQuery, supplierPaymentsQuery, supplierOutstanding } from "@/lib/finance";
import { breakdown, compareDip, deliveriesQuery, dipsQuery, movementsQuery } from "@/lib/inventory";
import { suppliersQuery, tanksQuery, formatNumber } from "@/lib/setup";
import { can } from "@/lib/permissions";
import { CreditSaleDialog, CustomerDialog, ExpenseDialog, PaySupplierDialog, PaymentDialog } from "@/components/finance/dialogs";
import { ReceiveFuelDialog } from "@/components/inventory/dialogs";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Today's summary — Al-Ghani Station" },
      { name: "description", content: "Your petrol station's daily summary and setup checklist." },
      { property: "og:title", content: "Today's summary — Al-Ghani Station" },
      { property: "og:description", content: "Your petrol station's daily summary and setup checklist." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const t = useT();
  const { data } = useSuspenseQuery(myStationQuery);
  const station = data!.station;

  const { status } = useSetupData(station.id);
  const today0 = todayKarachi();
  const [cu, tx, ex, sh, op, tk, mv, dp, dl, sp, su] = useSuspenseQueries({
    queries: [
      customersQuery(station.id), customerTxnsQuery(station.id), expensesQuery(station.id), shiftsQuery(station.id, today0), openShiftsQuery(station.id),
      tanksQuery(station.id), movementsQuery(station.id), dipsQuery(station.id), deliveriesQuery(station.id), supplierPaymentsQuery(station.id), suppliersQuery(station.id),
    ],
  });
  const [qa, setQa] = useState<"cust" | "sale" | "pay" | "fuel" | "sup" | "exp" | null>(null);
  const canEdit = data!.role !== "staff";
  const canDeliver = can(data!.role, "deliveries.record");
  const udhaar = cu.data.length ? round2(cu.data.reduce((a, c) => a + customerBalance(Number(c.opening_balance), tx.data.filter((x) => x.customer_id === c.id)), 0)) : null;
  const today = todayKarachi();
  const todays = ex.data.filter((x) => !x.reversed_at && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(x.occurred_at)) === today);
  const todayExp = todays.length ? round2(todays.reduce((a, x) => a + Number(x.amount), 0)) : null;
  type StepLink = { key: TranslationKey; done: boolean; to: "/setup" | "/settings"; step?: SetupStep };
  const steps: StepLink[] = [
    { key: "dashboard.step.station", done: true, to: "/settings" },
    { key: "dashboard.step.products", done: status.products, to: "/setup", step: "products" },
    { key: "dashboard.step.tanks", done: status.tanks, to: "/setup", step: "tanks" },
    { key: "dashboard.step.nozzles", done: status.nozzles, to: "/setup", step: "nozzles" },
    { key: "dashboard.step.prices", done: status.prices, to: "/setup", step: "prices" },
    { key: "dashboard.step.suppliers", done: status.suppliers, to: "/setup", step: "suppliers" },
  ];
  const firstPending = steps.find((s) => !s.done && s.step)?.step ?? "review";
  const doneCount = steps.filter((s) => s.done).length;
  const incomplete = doneCount < steps.length;

  // Every figure comes from saved records; null means nothing is recorded yet ("No data yet"), never a fake number.
  const closedToday = sh.data.filter((x) => x.status === "closed");
  const sum = (f: (x: (typeof closedToday)[0]) => number) => round2(closedToday.reduce((a, x) => a + f(x), 0));
  const activeTanks = tk.data.filter((x) => x.is_active);
  const expected = activeTanks.length ? round2(activeTanks.reduce((a, x) => a + breakdown(mv.data.filter((m) => m.tank_id === x.id)).expected, 0)) : null;
  const dipCmp = activeTanks
    .map((x) => compareDip(mv.data.filter((m) => m.tank_id === x.id), dp.data.filter((d) => d.tank_id === x.id)))
    .filter((c) => c !== null)
    .sort((a, b) => +new Date(b!.dip.measured_at) - +new Date(a!.dip.measured_at))[0] ?? null;
  const supDue = su.data.length
    ? round2(su.data.reduce((a, x) => a + supplierOutstanding(Number(x.opening_payable), dl.data.filter((d) => d.supplier_id === x.id), sp.data.filter((p) => p.supplier_id === x.id)).outstanding, 0))
    : null;
  const openShift = op.data[0];
  const L = (n: number) => `${formatNumber(n, 2)} L`;

  type Card = { key: TranslationKey; value: string | null; to: "/shifts" | "/customers" | "/fuel-stock" | "/suppliers" | "/expenses" | "/reports"; hint?: TranslationKey };
  const stats: Card[] = [
    { key: "dashboard.todaySales", value: closedToday.length ? formatPKR(sum((x) => Number(x.total_sales ?? 0))) : null, to: "/shifts", hint: "dash.salesHint" },
    { key: "dashboard.fuelLitres", value: closedToday.length ? L(sum((x) => Number(x.total_litres ?? 0))) : null, to: "/shifts", hint: "dash.salesHint" },
    { key: "dash.cashReceived", value: closedToday.length ? formatPKR(sum((x) => Number(x.cash_received ?? 0))) : null, to: "/shifts", hint: "dash.salesHint" },
    { key: "dash.shift", value: openShift ? t("dash.shiftOpen", { name: openShift.name }) : t("dash.shiftNone"), to: "/shifts" },
    { key: "dashboard.udhaar", value: udhaar === null ? null : formatPKR(udhaar), to: "/customers" },
    { key: "dash.supplierDue", value: supDue === null ? null : formatPKR(supDue), to: "/suppliers" },
    { key: "dash.expected", value: expected === null ? null : L(expected), to: "/fuel-stock" },
    { key: "dash.lastDip", value: dipCmp ? `${dipCmp.difference > 0 ? "+" : ""}${L(dipCmp.difference)}` : null, to: "/fuel-stock" },
    { key: "dashboard.expenses", value: todayExp === null ? null : formatPKR(todayExp), to: "/expenses" },
  ];

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.welcome", { station: station.name })} />

      {incomplete && (
        <section className="mb-8 rounded-2xl border bg-card p-5 shadow-card sm:p-6" aria-labelledby="checklist">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="checklist" className="text-lg font-semibold">{t("dashboard.checklistTitle")}</h2>
            <Badge variant="secondary" className="tabular-nums">{doneCount} / {steps.length}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.checklistDesc")}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-success transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <p className="mt-3 font-medium">{t("dashboard.setupProgress", { pct: Math.round((doneCount / steps.length) * 100) })}</p>
          <ul className="mt-4 divide-y">
            {steps.map((s) => (
              <li key={s.key}>
                <Link to={s.to} search={s.step ? { step: s.step } : {}} className="flex min-h-12 items-center gap-3 py-2 hover:text-primary">
                  {s.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex-1">{t(s.key)}</span>
                  <Badge className={s.done ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                    {t(s.done ? "dashboard.done" : "dashboard.pending")}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-4 h-11">
            <Link to="/setup" search={{ step: firstPending }}>{t("setup.continue")}</Link>
          </Button>
        </section>
      )}

      <section aria-labelledby="qa" className="mb-8">
        <h2 id="qa" className="mb-3 text-lg font-semibold">{t("fin.quickActions")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {canEdit && <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setQa("cust")}><UserPlus className="h-5 w-5" aria-hidden />{t("fin.qa.addCustomer")}</Button>}
          <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setQa("sale")} disabled={!cu.data.length}><CreditCard className="h-5 w-5" aria-hidden />{t("fin.qa.creditSale")}</Button>
          <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setQa("pay")} disabled={!cu.data.length}><HandCoins className="h-5 w-5" aria-hidden />{t("fin.qa.receivePayment")}</Button>
          {canDeliver && <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setQa("fuel")}><Truck className="h-5 w-5" aria-hidden />{t("inv.receive")}</Button>}
          {canEdit && <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setQa("sup")}><Banknote className="h-5 w-5" aria-hidden />{t("fin.qa.paySupplier")}</Button>}
          <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setQa("exp")}><Plus className="h-5 w-5" aria-hidden />{t("fin.qa.addExpense")}</Button>
        </div>
        {qa === "cust" && <CustomerDialog onClose={() => setQa(null)} />}
        {qa === "sale" && <CreditSaleDialog onClose={() => setQa(null)} />}
        {qa === "pay" && <PaymentDialog onClose={() => setQa(null)} />}
        {qa === "fuel" && <ReceiveFuelDialog onClose={() => setQa(null)} />}
        {qa === "sup" && <PaySupplierDialog onClose={() => setQa(null)} />}
        {qa === "exp" && <ExpenseDialog onClose={() => setQa(null)} />}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.key} to={s.to} className="block rounded-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${t(s.key)} — ${t("dash.open")}`}>
            <StatCard label={t(s.key)} value={s.value} emptyLabel={t("common.noData")} hint={s.hint ? t(s.hint) : t("dashboard.noDataHint")} storedLabel={t("common.stored")} />
          </Link>
        ))}
        <div className="rounded-xl border border-dashed bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">{t("dash.profit")}</p>
          <p className="mt-3 font-display text-xl font-bold text-muted-foreground">{t("dash.profitNA")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("dash.profitNAHint")}</p>
        </div>
      </div>
    </>
  );
}
