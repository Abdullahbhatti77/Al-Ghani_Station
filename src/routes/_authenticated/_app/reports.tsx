import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Download, Printer, Lock } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStationCtx } from "@/components/setup/shared";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatNumber, formatPKR, nozzlesQuery, productsQuery, suppliersQuery, tanksQuery } from "@/lib/setup";
import { peopleQuery, todayKarachi } from "@/lib/shifts";
import { categoriesQuery, customersQuery, customerTxnsQuery, downloadCSV, expensesQuery, supplierPaymentsQuery, toCSV } from "@/lib/finance";
import { deliveriesQuery, dipsQuery, movementsQuery } from "@/lib/inventory";
import {
  allShiftsQuery, closedInRange, customerBalancesAt, dailySales, deliveriesIn, expensesIn, karachiDate,
  presetRange, readingsQuery, salesBy, supplierPayablesAt, tankReport, varianceTotals, type Preset,
} from "@/lib/reports";

const TABS = ["daily", "product", "nozzle", "shifts", "variance", "stock", "deliveries", "customers", "suppliers", "expenses"] as const;
type Tab = (typeof TABS)[number];
const PRESETS = ["today", "yesterday", "week", "month", "custom"] as const;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

type Search = { tab: Tab; preset: Preset; from?: string; to?: string };

export const Route = createFileRoute("/_authenticated/_app/reports")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (TABS as readonly string[]).includes(s.tab as string) ? (s.tab as Tab) : "daily",
    preset: (PRESETS as readonly string[]).includes(s.preset as string) ? (s.preset as Preset) : "today",
    ...(isDate(s.from) ? { from: s.from } : {}),
    ...(isDate(s.to) ? { to: s.to } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Reports — PumpHisab" },
      { name: "description", content: "Daily sales, stock, udhaar, supplier and expense reports for your petrol station." },
      { property: "og:title", content: "Reports — PumpHisab" },
      { property: "og:description", content: "Daily sales, stock, udhaar, supplier and expense reports for your petrol station." },
    ],
  }),
  component: ReportsPage,
});

type Fmt = "pkr" | "l" | "n" | "text";
type Col<R> = { h: TranslationKey; v: (r: R) => string | number | null; f?: Fmt };
type Report = { cols: Col<Record<string, unknown>>[]; rows: Record<string, unknown>[]; totals?: (string | number | null)[]; summary?: { k: TranslationKey; v: string }[]; note?: TranslationKey };

const show = (v: string | number | null, f: Fmt = "text") =>
  v === null || v === "" ? "—" : f === "pkr" ? formatPKR(Number(v)) : f === "l" ? `${formatNumber(Number(v), 2)} L` : f === "n" ? formatNumber(Number(v)) : String(v);

function ReportsPage() {
  const { t } = useI18n();
  const { stationId, can } = useStationCtx();
  if (!can("reports.view")) {
    return (
      <>
        <PageHeader title={t("rep.title")} />
        <EmptyState icon={<Lock className="h-6 w-6" aria-hidden />} title={t("rep.noAccess")} body={t("rep.noAccessBody")} />
      </>
    );
  }
  return <Reports stationId={stationId} />;
}

function Reports({ stationId }: { stationId: string }) {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/reports" });
  const today = todayKarachi();
  const range = search.preset === "custom" ? { from: search.from ?? today, to: search.to ?? today } : presetRange(search.preset, today);
  const bad = range.from > range.to;

  const [shifts, readings, products, nozzles, tanks, suppliers, people, customers, txns, payments, categories, expenses, deliveries, movements, dips] = useSuspenseQueries({
    queries: [
      allShiftsQuery(stationId), readingsQuery(stationId), productsQuery(stationId), nozzlesQuery(stationId), tanksQuery(stationId),
      suppliersQuery(stationId), peopleQuery(stationId), customersQuery(stationId), customerTxnsQuery(stationId), supplierPaymentsQuery(stationId),
      categoriesQuery(stationId), expensesQuery(stationId), deliveriesQuery(stationId), movementsQuery(stationId), dipsQuery(stationId),
    ],
  });

  const name = <X extends { id: string }>(xs: X[], id: string, f: (x: X) => string) => { const x = xs.find((y) => y.id === id); return x ? f(x) : "—"; };
  const pName = (id: string) => name(products.data, id, (p) => p.name);
  const tName = (id: string) => name(tanks.data, id, (x) => x.name);
  const sName = (id: string) => name(suppliers.data, id, (x) => x.business_name);
  const person = (id: string) => people.data.find((p) => p.user_id === id)?.full_name ?? "—";

  const report: Report = useMemo(() => {
    const r = range;
    const S = shifts.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const as = (x: any) => x as Report;
    switch (search.tab) {
      case "daily": {
        const rows = dailySales(S, r);
        return as({
          note: "rep.onlyClosed",
          cols: [{ h: "rep.c.date", v: (x: typeof rows[0]) => x.date }, { h: "rep.c.shifts", v: (x: typeof rows[0]) => x.shifts, f: "n" }, { h: "rep.c.litres", v: (x: typeof rows[0]) => x.litres, f: "l" }, { h: "rep.c.sales", v: (x: typeof rows[0]) => x.sales, f: "pkr" }, { h: "rep.c.credit", v: (x: typeof rows[0]) => x.credit, f: "pkr" }, { h: "rep.c.collected", v: (x: typeof rows[0]) => x.collected, f: "pkr" }],
          rows,
          totals: [t("rep.total"), rows.reduce((a, x) => a + x.shifts, 0), sumOf(rows, "litres"), sumOf(rows, "sales"), sumOf(rows, "credit"), sumOf(rows, "collected")],
        });
      }
      case "product":
      case "nozzle": {
        const rows = salesBy(search.tab === "product" ? "product_id" : "nozzle_id", readings.data, S, r);
        const label = (id: string) => (search.tab === "product" ? pName(id) : name(nozzles.data, id, (n) => `${n.number} · ${n.display_name} (${pName(n.product_id)})`));
        return as({
          note: "rep.onlyClosed",
          cols: [{ h: search.tab === "product" ? "rep.c.product" : "rep.c.nozzle", v: (x: typeof rows[0]) => label(x.id) }, { h: "rep.c.litres", v: (x: typeof rows[0]) => x.litres, f: "l" }, { h: "rep.c.sales", v: (x: typeof rows[0]) => x.amount, f: "pkr" }],
          rows,
          totals: [t("rep.total"), sumOf(rows, "litres"), sumOf(rows, "amount")],
        });
      }
      case "shifts":
      case "variance": {
        const rows = closedInRange(S, r);
        const v = varianceTotals(S, r);
        const base = [{ h: "rep.c.date", v: (x: typeof rows[0]) => x.shift_date }, { h: "rep.c.shift", v: (x: typeof rows[0]) => x.name }, { h: "rep.c.attendant", v: (x: typeof rows[0]) => person(x.attendant_id) }];
        if (search.tab === "shifts")
          return as({
            cols: [...base, { h: "rep.c.litres", v: (x: typeof rows[0]) => x.total_litres, f: "l" }, { h: "rep.c.sales", v: (x: typeof rows[0]) => x.total_sales, f: "pkr" }, { h: "rep.c.collected", v: (x: typeof rows[0]) => x.total_collected, f: "pkr" }, { h: "rep.c.difference", v: (x: typeof rows[0]) => x.difference, f: "pkr" }],
            rows,
            totals: [t("rep.total"), "", "", sumOf(rows, "total_litres"), sumOf(rows, "total_sales"), sumOf(rows, "total_collected"), sumOf(rows, "difference")],
          });
        return as({
          cols: [...base, { h: "rep.c.difference", v: (x: typeof rows[0]) => x.difference, f: "pkr" }, { h: "rep.c.drawer", v: (x: typeof rows[0]) => x.cash_variance, f: "pkr" }],
          rows: rows.filter((x) => Math.abs(Number(x.difference ?? 0)) >= 0.01 || Math.abs(Number(x.cash_variance ?? 0)) >= 0.01),
          summary: [{ k: "rep.shortage", v: formatPKR(v.shortage) }, { k: "rep.surplus", v: formatPKR(v.surplus) }, { k: "rep.net", v: formatPKR(v.net) }, { k: "rep.drawerNet", v: formatPKR(v.cashNet) }],
        });
      }
      case "stock": {
        const rows = tanks.data.filter((x) => x.is_active).map((tank) => ({ tank, ...tankReport(movements.data.filter((m) => m.tank_id === tank.id), dips.data.filter((d) => d.tank_id === tank.id), r) }));
        type R = (typeof rows)[0];
        return as({
          cols: [{ h: "rep.c.tank", v: (x: R) => `${x.tank.name} (${pName(x.tank.product_id)})` }, { h: "rep.c.opening", v: (x: R) => x.opening, f: "l" }, { h: "rep.c.deliveries", v: (x: R) => x.deliveries, f: "l" }, { h: "rep.c.salesL", v: (x: R) => x.sales, f: "l" }, { h: "rep.c.adjust", v: (x: R) => x.adjustments, f: "l" }, { h: "rep.c.closing", v: (x: R) => x.closing, f: "l" }, { h: "rep.c.dip", v: (x: R) => (x.dip ? Number(x.dip.dip.measured_litres) : null), f: "l" }, { h: "rep.c.dipDiff", v: (x: R) => (x.dip ? x.dip.difference : null), f: "l" }],
          rows,
        });
      }
      case "deliveries": {
        const d = deliveriesIn(deliveries.data, r);
        type R = (typeof d.rows)[0];
        return as({
          cols: [{ h: "rep.c.date", v: (x: R) => karachiDate(x.delivered_at) }, { h: "rep.c.challan", v: (x: R) => x.challan_no }, { h: "rep.c.supplier", v: (x: R) => sName(x.supplier_id) }, { h: "rep.c.tank", v: (x: R) => tName(x.tank_id) }, { h: "rep.c.litres", v: (x: R) => x.litres, f: "l" }, { h: "rep.c.invoice", v: (x: R) => x.invoice_amount, f: "pkr" }],
          rows: d.rows,
          totals: [t("rep.total"), "", "", "", d.litres, d.amount],
        });
      }
      case "customers": {
        const rows = customerBalancesAt(customers.data, txns.data, r.to);
        type R = (typeof rows)[0];
        return as({
          cols: [{ h: "rep.c.customer", v: (x: R) => x.customer.business_name ? `${x.customer.name} (${x.customer.business_name})` : x.customer.name }, { h: "rep.c.balance", v: (x: R) => x.balance, f: "pkr" }],
          rows,
          totals: [t("rep.total"), rows.reduce((a, x) => a + x.balance, 0)],
        });
      }
      case "suppliers": {
        const rows = supplierPayablesAt(suppliers.data, deliveries.data, payments.data, r.to);
        type R = (typeof rows)[0];
        return as({
          cols: [{ h: "rep.c.supplier", v: (x: R) => x.supplier.business_name }, { h: "rep.c.purchases", v: (x: R) => x.purchases, f: "pkr" }, { h: "rep.c.paid", v: (x: R) => x.paid, f: "pkr" }, { h: "rep.c.outstanding", v: (x: R) => x.outstanding, f: "pkr" }],
          rows,
          totals: [t("rep.total"), sumOf(rows, "purchases"), sumOf(rows, "paid"), sumOf(rows, "outstanding")],
        });
      }
      case "expenses": {
        const e = expensesIn(expenses.data, r);
        const cName = (id: string) => name(categories.data, id, (c) => c.name);
        type R = (typeof e.rows)[0];
        return as({
          cols: [{ h: "rep.c.date", v: (x: R) => karachiDate(x.occurred_at) }, { h: "rep.c.category", v: (x: R) => cName(x.category_id) }, { h: "rep.c.description", v: (x: R) => x.description }, { h: "rep.c.amount", v: (x: R) => x.amount, f: "pkr" }],
          rows: e.rows,
          totals: [t("rep.total"), "", "", e.total],
          summary: e.byCategory.map((c) => ({ k: "rep.c.category", v: `${cName(c.id)}: ${formatPKR(c.amount)}` })),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.tab, range.from, range.to, shifts.data, readings.data, products.data, nozzles.data, tanks.data, suppliers.data, people.data, customers.data, txns.data, payments.data, categories.data, expenses.data, deliveries.data, movements.data, dips.data, t]);

  const setSearch = (s: Partial<Search>) => navigate({ search: (p) => ({ ...p, ...s }), replace: true });
  const balanceTab = search.tab === "customers" || search.tab === "suppliers";

  function exportCsv() {
    const csv = toCSV(report.cols.map((c) => t(c.h)), [...report.rows.map((r) => report.cols.map((c) => c.v(r))), ...(report.totals ? [report.totals] : [])]);
    downloadCSV(`pumphisab-${search.tab}-${range.from}-${range.to}.csv`, csv);
  }

  return (
    <>
      <PageHeader
        title={t("rep.title")}
        description={t("rep.desc")}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" className="h-11" onClick={exportCsv} disabled={bad || report.rows.length === 0}><Download className="h-4 w-4" aria-hidden />{t("rep.csv")}</Button>
            <Button variant="outline" className="h-11" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />{t("rep.print")}</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 shadow-card print:hidden sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="rep-tab">{t("rep.choose")}</Label>
          <Select value={search.tab} onValueChange={(v) => setSearch({ tab: v as Tab })}>
            <SelectTrigger id="rep-tab" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{TABS.map((x) => <SelectItem key={x} value={x}>{t(`rep.t.${x}` as TranslationKey)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-end gap-1.5 sm:col-span-2 lg:col-span-3">
          {PRESETS.map((p) => (
            <Button key={p} type="button" variant={search.preset === p ? "default" : "outline"} className="h-11"
              onClick={() => setSearch(p === "custom" ? { preset: p, from: range.from, to: range.to } : { preset: p, from: undefined, to: undefined })}>
              {t(`rep.preset.${p}` as TranslationKey)}
            </Button>
          ))}
        </div>
        {search.preset === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rep-from">{t("rep.from")}</Label>
              <Input id="rep-from" type="date" className="h-11" value={range.from} max={today} onChange={(e) => isDate(e.target.value) && setSearch({ from: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-to">{t("rep.to")}</Label>
              <Input id="rep-to" type="date" className="h-11" value={range.to} max={today} onChange={(e) => isDate(e.target.value) && setSearch({ to: e.target.value })} />
            </div>
          </>
        )}
      </div>

      <section aria-labelledby="rep-h" className="rounded-xl border bg-card p-4 shadow-card sm:p-6">
        <h2 id="rep-h" className="text-xl font-semibold">{t(`rep.t.${search.tab}` as TranslationKey)}</h2>
        <p className="mt-1 text-sm font-medium">{balanceTab ? t("rep.asOf", { date: range.to }) : t("rep.period", { from: range.from, to: range.to })}</p>
        <p className="mt-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{t(`rep.x.${search.tab}` as TranslationKey)}{report.note ? ` ${t(report.note)}` : ""}</p>

        {bad ? (
          <p role="alert" className="mt-4 text-destructive">{t("rep.badRange")}</p>
        ) : (
          <>
            {report.summary && report.summary.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {report.summary.map((s, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t(s.k)}</p>
                    <p className="font-display text-lg font-bold tabular-nums">{s.v}</p>
                  </div>
                ))}
              </div>
            )}
            {report.rows.length === 0 ? (
              <div className="mt-4"><EmptyState title={t("rep.empty")} body={t("rep.emptyBody")} /></div>
            ) : (
              <ReportTable report={report} />
            )}
          </>
        )}
      </section>
    </>
  );
}

function sumOf<R>(rows: R[], k: keyof R) {
  return Math.round(rows.reduce((a, x) => a + Number(x[k] ?? 0), 0) * 100) / 100;
}

function ReportTable({ report }: { report: Report }) {
  const { t } = useI18n();
  const num = (f?: Fmt) => f && f !== "text";
  const totalsCell = (i: number) => {
    const v = report.totals?.[i];
    return v === "" || v === undefined ? "" : typeof v === "number" ? show(v, report.cols[i]?.f) : String(v);
  };
  return (
    <>
      {/* desktop / print table */}
      <div className="mt-4 hidden overflow-x-auto sm:block print:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {report.cols.map((c) => <th key={c.h} className={`px-2 py-2 font-medium ${num(c.f) ? "text-right" : ""}`}>{t(c.h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                {report.cols.map((c) => <td key={c.h} className={`px-2 py-2 ${num(c.f) ? "text-right tabular-nums" : ""}`}>{show(c.v(r), c.f)}</td>)}
              </tr>
            ))}
          </tbody>
          {report.totals && (
            <tfoot>
              <tr className="border-t-2 font-semibold">
                {report.cols.map((c, i) => <td key={c.h} className={`px-2 py-2 ${num(c.f) ? "text-right tabular-nums" : ""}`}>{totalsCell(i)}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/* mobile cards */}
      <ul className="mt-4 space-y-2 sm:hidden print:hidden">
        {report.rows.map((r, i) => (
          <li key={i} className="rounded-lg border p-3">
            <p className="font-semibold">{show(report.cols[0]!.v(r), report.cols[0]!.f)}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {report.cols.slice(1).map((c) => (
                <div key={c.h} className="contents">
                  <dt className="text-muted-foreground">{t(c.h)}</dt>
                  <dd className="text-right tabular-nums">{show(c.v(r), c.f)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        {report.totals && (
          <li className="rounded-lg border-2 border-primary/30 p-3">
            <p className="font-semibold">{t("rep.total")}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {report.cols.slice(1).map((c, i) => totalsCell(i + 1) !== "" && (
                <div key={c.h} className="contents">
                  <dt className="text-muted-foreground">{t(c.h)}</dt>
                  <dd className="text-right font-semibold tabular-nums">{totalsCell(i + 1)}</dd>
                </div>
              ))}
            </dl>
          </li>
        )}
      </ul>
    </>
  );
}
