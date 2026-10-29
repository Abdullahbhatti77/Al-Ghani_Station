import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Pencil, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormDialog, useStationCtx } from "@/components/setup/shared";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatNumber, formatPKR, nozzlesQuery, pricesQuery, productsQuery } from "@/lib/setup";
import {
  COLLECTION_FIELDS, litresSold, parseNum, peopleQuery, priceAt, readingIssue, reconcile, saleAmount, shiftErrorKey, shiftQuery,
  SHIFT_STEPS, type CollectionField, type Shift, type ShiftReading, type ShiftStep,
} from "@/lib/shifts";
import { supabase } from "@/integrations/supabase/client";
import { ClosingPanels, computeClosing, ShiftLinkedRecords, useShiftMoney } from "@/components/finance/shift-cash";

export const Route = createFileRoute("/_authenticated/_app/shifts_/$shiftId")({
  validateSearch: zodValidator(z.object({ step: fallback(z.string(), "start").default("start"), done: fallback(z.boolean(), false).optional() })),
  head: () => ({
    meta: [
      { title: "Shift — PumpHisab" },
      { name: "description", content: "Enter meter readings, review sales and close the shift." },
      { property: "og:title", content: "Shift — PumpHisab" },
      { property: "og:description", content: "Enter meter readings, review sales and close the shift." },
    ],
  }),
  component: ShiftPage,
});

type Draft = { closing: string; test: string };
const L = (n: number) => formatNumber(n, 2);

function ShiftPage() {
  const { shiftId } = Route.useParams();
  const { data } = useSuspenseQuery(shiftQuery(shiftId));
  const t = useT();
  if (!data.shift) return <EmptyState title={t("shift.notFound")} action={<Button asChild><Link to="/shifts">{t("shift.backToList")}</Link></Button>} />;
  return <ShiftWizard key={data.shift.id} shift={data.shift} readings={data.readings} corrections={data.corrections} />;
}

function ShiftWizard({ shift, readings, corrections }: { shift: Shift; readings: ShiftReading[]; corrections: { id: string; field: string; old_value: number | null; new_value: number | null; reason: string; created_at: string; created_by: string }[] }) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/shifts/$shiftId" });
  const { step: raw, done } = Route.useSearch();
  const { stationId, canEdit } = useStationCtx();
  const { data: nozzles } = useSuspenseQuery(nozzlesQuery(stationId));
  const { data: products } = useSuspenseQuery(productsQuery(stationId));
  const { data: prices } = useSuspenseQuery(pricesQuery(stationId));
  const { data: people } = useSuspenseQuery(peopleQuery(stationId));
  const closed = shift.status === "closed";
  const step: ShiftStep = (SHIFT_STEPS as readonly string[]).includes(raw) ? (raw as ShiftStep) : "start";
  const idx = SHIFT_STEPS.indexOf(step);

  const sorted = useMemo(() => {
    const no = (id: string) => nozzles.find((n) => n.id === id)?.number ?? 0;
    return [...readings].sort((a, b) => no(a.nozzle_id) - no(b.nozzle_id));
  }, [readings, nozzles]);

  // local draft state, recovered from what is saved in the database
  const [header, setHeader] = useState({ name: shift.name, attendant_id: shift.attendant_id, opening_float: String(shift.opening_float), notes: shift.notes ?? "", cash_counted: shift.cash_counted === null ? "" : String(shift.cash_counted) });
  const [closeReason, setCloseReason] = useState("");
  const [coll, setColl] = useState<Record<CollectionField, string>>(() => Object.fromEntries(COLLECTION_FIELDS.map((f) => [f, String(shift[f])])) as Record<CollectionField, string>);
  const [vals, setVals] = useState<Record<string, Draft>>(() => Object.fromEntries(readings.map((r) => [r.id, { closing: r.closing_reading === null ? "" : String(r.closing_reading), test: String(r.test_litres) }])));
  useEffect(() => {
    // keep newly-corrected opening/rollover in view without losing typed values
    setVals((v) => ({ ...Object.fromEntries(readings.map((r) => [r.id, { closing: r.closing_reading === null ? "" : String(r.closing_reading), test: String(r.test_litres) }])), ...v }));
  }, [readings]);
  const [busy, setBusy] = useState(false);

  const priceTime = new Date(shift.price_at);
  const rows = sorted.map((r) => {
    const nz = nozzles.find((n) => n.id === r.nozzle_id);
    const prod = products.find((p) => p.id === r.product_id);
    const d = vals[r.id] ?? { closing: "", test: "0" };
    const closing = closed ? Number(r.closing_reading) : parseNum(d.closing);
    const test = closed ? Number(r.test_litres) : (parseNum(d.test) ?? 0);
    const input = { opening: Number(r.opening_reading), closing: closing === null || Number.isNaN(closing) ? null : closing, test: Number.isNaN(test) ? 0 : test, rollover: r.rollover_max === null ? null : Number(r.rollover_max) };
    const issue = Number.isNaN(closing as number) ? "missing" : readingIssue(input);
    const litres = closed ? Number(r.litres_sold) : issue ? null : litresSold(input);
    const p = closed ? (r.price_per_litre === null ? null : Number(r.price_per_litre)) : (() => { const x = priceAt(prices, r.product_id, priceTime); return x ? Number(x.price_per_litre) : null; })();
    const amount = closed ? Number(r.amount) : litres !== null && p !== null ? saleAmount(litres, p) : null;
    return { r, nz, prod, d, input, issue, litres, price: p, amount };
  });
  const totalSales = closed ? Number(shift.total_sales) : rows.reduce((s, x) => s + (x.amount ?? 0), 0);
  const totalLitres = closed ? Number(shift.total_litres) : rows.reduce((s, x) => s + (x.litres ?? 0), 0);
  const collNums = Object.fromEntries(COLLECTION_FIELDS.map((f) => [f, closed ? Number(shift[f]) : (parseNum(coll[f]) ?? 0)])) as Record<CollectionField, number>;
  const rec = reconcile(totalSales, collNums);
  const money = useShiftMoney(stationId, shift.id);
  const floatNum = closed ? Number(shift.opening_float) : (parseNum(header.opening_float) || 0);
  const countedNum = closed ? (shift.cash_counted === null ? null : Number(shift.cash_counted)) : (() => { const n = parseNum(header.cash_counted); return n === null || Number.isNaN(n) || n < 0 ? null : n; })();
  const closing = computeClosing(shift, totalSales, collNums, floatNum, countedNum, money.linked);
  const hasVariance = closing.sales.status !== "matched" || (closing.cashStatus !== null && closing.cashStatus !== "matched");
  const hasIssues = rows.some((x) => x.issue);
  const missingPrice = rows.some((x) => x.price === null);
  const person = (id: string) => people.find((p) => p.user_id === id)?.full_name ?? "—";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shift", shift.id] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
    qc.invalidateQueries({ queryKey: ["shifts-open"] });
    qc.invalidateQueries({ queryKey: ["nozzles", stationId] });
  };

  async function saveDraft(quiet = false) {
    if (closed) return true;
    const f = parseNum(header.opening_float);
    const bad = COLLECTION_FIELDS.some((k) => { const n = parseNum(coll[k]); return n !== null && (Number.isNaN(n) || n < 0); })
      || f === null || Number.isNaN(f) || f < 0
      || rows.some((x) => { const n = parseNum(x.d.test); return n !== null && (Number.isNaN(n) || n < 0); });
    if (bad) { toast.error(t("validation.nonNegative")); return false; }
    setBusy(true);
    const { error } = await supabase.rpc("save_shift_draft", {
      _shift_id: shift.id,
      _header: { ...header, opening_float: f, cash_counted: (() => { const n = parseNum(header.cash_counted); return n === null || Number.isNaN(n) || n < 0 ? null : n; })(), ...Object.fromEntries(COLLECTION_FIELDS.map((k) => [k, parseNum(coll[k]) ?? 0])) },
      _readings: rows.map((x) => {
        const c = parseNum(x.d.closing);
        return { id: x.r.id, closing_reading: c === null || Number.isNaN(c) || c < 0 ? null : c, test_litres: parseNum(x.d.test) ?? 0 };
      }),
    });
    setBusy(false);
    if (error) { toast.error(t(shiftErrorKey(error))); return false; }
    if (!quiet) toast.success(t("shift.draftSaved"));
    refresh();
    return true;
  }

  const go = async (s: ShiftStep) => {
    if (!closed && !(await saveDraft(true))) return;
    navigate({ search: { step: s } });
  };
  const next = () => {
    if (step === "readings" && hasIssues) return void toast.error(t("shift.fixIssues"));
    void go(SHIFT_STEPS[idx + 1]!);
  };

  async function closeShift() {
    if (!(await saveDraft(true))) return;
    setBusy(true);
    const { error } = await supabase.rpc("close_shift", { _shift_id: shift.id, _reason: closeReason || undefined });
    setBusy(false);
    refresh();
    if (error) return void toast.error(t(shiftErrorKey(error)));
    navigate({ search: { step: "close", done: true } });
  }

  if (closed && done) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-success" aria-hidden />
        <h1 className="text-2xl font-bold">{t("shift.closedTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("shift.closedBody")}</p>
        <div className="my-6 grid grid-cols-2 gap-3 text-left">
          <Big label={t("shift.totalSales")} value={formatPKR(totalSales)} />
          <Big label={t("shift.collected")} value={formatPKR(rec.collected)} />
          <Big label={t("shift.totalLitres")} value={`${L(totalLitres)} L`} />
          <Big label={t("shift.difference")} value={<DiffText rec={closing.sales} />} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline" className="h-12"><Link to="/shifts">{t("shift.backToList")}</Link></Button>
          <Button asChild className="h-12"><Link to="/shifts">{t("shift.startNext")}</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`${shift.name} · ${shift.shift_date}`}
        description={`${t("shift.attendant")}: ${person(shift.attendant_id)}`}
        actions={<Button asChild variant="outline" className="h-11"><Link to="/shifts"><ChevronLeft className="h-4 w-4" aria-hidden />{t("shift.backToList")}</Link></Button>}
      />
      {closed && (
        <p className="mb-4 rounded-lg bg-secondary p-3 text-sm">
          {t("shift.closedReadOnly")} {shift.closed_at && t("shift.closedBy", { d: new Date(shift.closed_at).toLocaleString("en-PK") })}
        </p>
      )}

      <nav aria-label={t("shift.title")} className="mb-6 rounded-2xl border bg-card p-3 shadow-card">
        <ol className="flex gap-2 overflow-x-auto">
          {SHIFT_STEPS.map((s, i) => (
            <li key={s} className="shrink-0">
              <button type="button" onClick={() => void go(s)} aria-current={s === step ? "step" : undefined}
                className={cn("flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm", s === step ? "border-primary bg-primary text-primary-foreground" : i < idx || closed ? "border-success/50" : "hover:bg-muted")}>
                {i < idx || closed ? <CheckCircle2 className={cn("h-4 w-4", s !== step && "text-success")} aria-hidden /> : <span className="w-4 text-xs font-bold">{i + 1}</span>}
                {t(`shift.step.${s}` as TranslationKey)}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="sh-step">
        <h2 id="sh-step" className="mb-4 text-xl font-semibold">{t(`shift.step.${step}` as TranslationKey)}</h2>

        {step === "start" && (
          <div className="space-y-6">
            <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="h-name">{t("shift.name")}</Label>
                <Input id="h-name" value={header.name} disabled={closed} onChange={(e) => setHeader({ ...header, name: e.target.value })} className="h-12 text-lg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-att">{t("shift.attendant")}</Label>
                <Select value={header.attendant_id} onValueChange={(v) => setHeader({ ...header, attendant_id: v })} disabled={closed}>
                  <SelectTrigger id="h-att" className="h-12 text-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-float">{t("shift.float")}</Label>
                <Input id="h-float" inputMode="decimal" value={header.opening_float} disabled={closed} onChange={(e) => setHeader({ ...header, opening_float: e.target.value })} className="h-12 text-lg tabular-nums" />
              </div>
            </div>
            <p className="rounded-lg bg-secondary p-3 text-sm">{t("shift.openingIntro")}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((x) => (
                <div key={x.r.id} className="rounded-xl border bg-card p-4">
                  <p className="text-sm text-muted-foreground">{t("shift.nozzle")} {x.nz?.number} · {x.nz?.display_name}</p>
                  <p className="font-semibold">{x.prod?.name}</p>
                  <p className="mt-2 font-display text-2xl font-bold tabular-nums">{L(x.input.opening)}</p>
                  <p className="text-xs text-muted-foreground">{t(`shift.source.${x.r.opening_source}` as TranslationKey)}</p>
                  {canEdit && !closed && <ReasonDialog reading={x.r} kind="opening" onDone={refresh} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "readings" && (
          <div className="space-y-3">
            <p className="rounded-lg bg-secondary p-3 text-sm">{t("shift.readingsIntro")}</p>
            {rows.map((x) => (
              <div key={x.r.id} className={cn("rounded-xl border bg-card p-4", x.issue && x.issue !== "missing" && "border-destructive bg-destructive/5")}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold"><span className="font-display text-xl">#{x.nz?.number}</span> {x.nz?.display_name} · <span className="text-muted-foreground">{x.prod?.name}</span></p>
                  <p className="text-sm">{t("shift.opening")}: <span className="font-semibold tabular-nums">{L(x.input.opening)}</span></p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`c-${x.r.id}`}>{t("shift.closing")}</Label>
                    <Input id={`c-${x.r.id}`} inputMode="decimal" disabled={closed} value={closed ? String(x.r.closing_reading) : x.d.closing}
                      onChange={(e) => setVals({ ...vals, [x.r.id]: { ...x.d, closing: e.target.value } })}
                      aria-invalid={!!x.issue && x.issue !== "missing"} className="h-14 text-2xl font-semibold tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`t-${x.r.id}`}>{t("shift.test")}</Label>
                    <Input id={`t-${x.r.id}`} inputMode="decimal" disabled={closed} value={closed ? String(x.r.test_litres) : x.d.test}
                      onChange={(e) => setVals({ ...vals, [x.r.id]: { ...x.d, test: e.target.value } })} className="h-14 text-xl tabular-nums" />
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm text-muted-foreground">{t("shift.litres")}</p>
                    <p className="font-display text-2xl font-bold tabular-nums">{x.litres === null ? "—" : `${L(x.litres)} L`}</p>
                  </div>
                </div>
                {x.r.rollover_max !== null && <p className="mt-2 text-sm"><RotateCcw className="mr-1 inline h-4 w-4" aria-hidden />{t("shift.rolloverSet", { v: L(Number(x.r.rollover_max)) })}</p>}
                {x.issue && (
                  <p role="alert" className={cn("mt-2 flex items-center gap-2 text-sm", x.issue === "missing" ? "text-muted-foreground" : "font-medium text-destructive")}>
                    {x.issue !== "missing" && <AlertTriangle className="h-4 w-4" aria-hidden />}
                    {t(`shift.issue.${x.issue}` as TranslationKey)}
                    {x.issue !== "missing" && !canEdit && ` ${t("shift.needManager")}`}
                  </p>
                )}
                {canEdit && !closed && (x.issue === "belowOpening" || x.issue === "aboveRollover" || x.r.rollover_max !== null) && <ReasonDialog reading={x.r} kind="rollover" onDone={refresh} />}
              </div>
            ))}
          </div>
        )}

        {(step === "review" || step === "close") && (
          <div className="space-y-4">
            {step === "close" && !closed && <p className="rounded-lg bg-secondary p-3 text-sm">{t("shift.closeIntro")}</p>}
            <p className="text-sm text-muted-foreground">{t("shift.priceAsOf", { d: priceTime.toLocaleString("en-PK") })}</p>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left"><tr>
                  <th className="p-3">{t("shift.nozzle")}</th><th className="p-3">{t("shift.fuel")}</th>
                  <th className="p-3 text-right">{t("shift.opening")}</th><th className="p-3 text-right">{t("shift.closing")}</th>
                  <th className="p-3 text-right">{t("shift.test")}</th><th className="p-3 text-right">{t("shift.litres")}</th>
                  <th className="p-3 text-right">{t("shift.rate")}</th><th className="p-3 text-right">{t("shift.amount")}</th>
                </tr></thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.r.id} className="border-t">
                      <td className="p-3">#{x.nz?.number} {x.nz?.display_name}</td><td className="p-3">{x.prod?.name}</td>
                      <td className="p-3 text-right tabular-nums">{L(x.input.opening)}</td>
                      <td className="p-3 text-right tabular-nums">{x.input.closing === null ? "—" : L(x.input.closing)}</td>
                      <td className="p-3 text-right tabular-nums">{L(x.input.test)}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{x.litres === null ? <span className="text-destructive">{t(`shift.issue.${x.issue ?? "missing"}` as TranslationKey)}</span> : L(x.litres)}</td>
                      <td className="p-3 text-right tabular-nums">{x.price === null ? <span className="text-destructive">{t("shift.noPrice")}</span> : formatPKR(x.price)}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{x.amount === null ? "—" : formatPKR(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="font-semibold">{t("shift.byProduct")}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {products.filter((p) => rows.some((x) => x.r.product_id === p.id)).map((p) => {
                const pr = rows.filter((x) => x.r.product_id === p.id);
                return <Big key={p.id} label={p.name} value={formatPKR(pr.reduce((s, x) => s + (x.amount ?? 0), 0))} sub={`${L(pr.reduce((s, x) => s + (x.litres ?? 0), 0))} L`} />;
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Big label={t("shift.totalSales")} value={formatPKR(totalSales)} sub={`${L(totalLitres)} L`} strong />
            </div>
            {step === "close" && <ClosingPanels shift={shift} stationId={stationId} totalSales={totalSales} coll={collNums} float={floatNum} counted={countedNum} closed={closed} />}
            {step === "close" && !closed && (
              <div className="flex justify-end">
                {hasIssues || missingPrice ? (
                  <p role="alert" className="text-sm font-medium text-destructive">{t(missingPrice ? "shift.err.noPrice" : "shift.fixIssues")}</p>
                ) : countedNum === null ? (
                  <p role="alert" className="text-sm font-medium text-destructive">{t("fin.err.cashCountMissing")}</p>
                ) : hasVariance && !canEdit ? (
                  <p role="alert" className="text-sm font-medium text-destructive">{t("fin.close.staffBlocked")}</p>
                ) : (
                  <div className="w-full space-y-3">
                  {hasVariance && (
                    <div className="space-y-1.5 rounded-xl border border-warning bg-warning/10 p-4">
                      <Label htmlFor="close-reason">{t("fin.close.reasonLabel")}</Label>
                      <Textarea id="close-reason" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} maxLength={500} />
                      <p className="text-xs text-muted-foreground">{t("fin.close.reasonHelp")}</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                  <ConfirmDialog
                    trigger={<Button size="lg" className="h-14 px-8 text-lg" disabled={busy}>{t("shift.closeNow")}</Button>}
                    title={t("shift.closeConfirmTitle")}
                    body={`${t("shift.closeConfirmBody", { sales: formatPKR(totalSales), collected: formatPKR(rec.collected) })} ${t("fin.close.variances", { a: formatPKR(closing.sales.difference), b: formatPKR(closing.cashDiff ?? 0) })}`}
                    confirmLabel={t("shift.closeNow")}
                    onConfirm={() => { if (hasVariance && closeReason.trim().length < 3) return void toast.error(t("validation.reasonMin")); void closeShift(); }}
                  />
                  </div>
                  </div>
                )}
              </div>
            )}
            {closed && (
              <>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    {rows.map((x) => <ClosedReadingDialog key={x.r.id} reading={x.r} label={`#${x.nz?.number}`} onDone={refresh} />)}
                  </div>
                )}
                <History corrections={corrections} person={person} />
              </>
            )}
          </div>
        )}

        {step === "reconcile" && (
          <div className="space-y-4">
            <p className="rounded-lg bg-secondary p-3 text-sm">{t("shift.reconcileIntro")}</p>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
                {COLLECTION_FIELDS.map((f) => (
                  <div key={f} className="space-y-1.5">
                    <Label htmlFor={`col-${f}`}>{t(`shift.${f}` as TranslationKey)}</Label>
                    <Input id={`col-${f}`} inputMode="decimal" disabled={closed} value={closed ? String(shift[f]) : coll[f]} onChange={(e) => setColl({ ...coll, [f]: e.target.value })} className="h-12 text-lg tabular-nums" />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label htmlFor="h-counted">{t("fin.close.countedLabel")}</Label>
                  <Input id="h-counted" inputMode="decimal" disabled={closed} value={closed ? String(shift.cash_counted ?? "") : header.cash_counted} onChange={(e) => setHeader({ ...header, cash_counted: e.target.value })} className="h-12 text-lg font-semibold tabular-nums" />
                  <p className="text-xs text-muted-foreground">{t("fin.close.countedHelp")}</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="h-notes">{t("shift.notes")}</Label>
                  <Textarea id="h-notes" disabled={closed} value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} maxLength={1000} />
                </div>
              </div>
              <div className="space-y-3">
                <Big label={t("shift.totalSales")} value={formatPKR(totalSales)} strong />
                <Big label={t("shift.collected")} value={formatPKR(rec.collected)} />
                <Big label={t("fin.close.credit")} value={formatPKR(money.linked.creditSales)} />
                <p className="text-xs text-muted-foreground">{t("shift.float")}: {formatPKR(parseNum(header.opening_float) || 0)}</p>
                {closed && canEdit && <CollectionsDialog shift={shift} onDone={refresh} />}
              </div>
            </div>
            <ClosingPanels shift={shift} stationId={stationId} totalSales={totalSales} coll={collNums} float={floatNum} counted={countedNum} closed={closed} />
            <ShiftLinkedRecords shift={shift} stationId={stationId} closed={closed} />
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-wrap justify-between gap-2">
        <Button variant="outline" className="h-12" disabled={idx === 0 || busy} onClick={() => void go(SHIFT_STEPS[idx - 1]!)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />{t("shift.back")}
        </Button>
        <div className="flex gap-2">
          {!closed && <Button variant="outline" className="h-12" disabled={busy} onClick={() => void saveDraft()}><Save className="h-4 w-4" aria-hidden />{t("shift.saveDraft")}</Button>}
          {idx < SHIFT_STEPS.length - 1 && <Button className="h-12" disabled={busy} onClick={next}>{closed ? t("setup.next") : t("shift.next")}<ChevronRight className="h-4 w-4" aria-hidden /></Button>}
        </div>
      </div>
    </>
  );
}

function Big({ label, value, sub, strong }: { label: string; value: React.ReactNode; sub?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", strong && "border-primary")}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-sm text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  );
}

function DiffText({ rec }: { rec: ReturnType<typeof reconcile> }) {
  const t = useT();
  const v = formatPKR(Math.abs(rec.difference));
  if (rec.status === "matched") return <span className="text-success">{t("shift.matched")}</span>;
  return <span className={rec.status === "short" ? "text-destructive" : "text-warning-foreground"}>{t(rec.status === "short" ? "shift.short" : "shift.excess", { v })}</span>;
}

function useReasonForm() {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return { value, setValue, reason, setReason, err, setErr };
}

function ReasonDialog({ reading, kind, onDone }: { reading: ShiftReading; kind: "opening" | "rollover"; onDone: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const f = useReasonForm();
  const isOpening = kind === "opening";
  async function submit(clear = false) {
    const v = clear ? null : parseNum(f.value);
    if (!clear && (v === null || Number.isNaN(v) || v < 0)) return f.setErr(t("validation.nonNegative"));
    if (f.reason.trim().length < 3) return f.setErr(t("validation.reasonMin"));
    const { error } = isOpening
      ? await supabase.rpc("correct_shift_opening", { _reading_id: reading.id, _value: v as number, _reason: f.reason })
      : await supabase.rpc("set_shift_rollover", { _reading_id: reading.id, _rollover: v as number, _reason: f.reason });
    if (error) return f.setErr(t(shiftErrorKey(error)));
    toast.success(t("shift.corrected"));
    setOpen(false);
    onDone();
  }
  return (
    <>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => { f.setValue(String(isOpening ? reading.opening_reading : reading.rollover_max ?? "")); setOpen(true); }}>
        {isOpening ? <Pencil className="h-4 w-4" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
        {t(isOpening ? "shift.correctOpening" : "shift.rollover")}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title={t(isOpening ? "shift.correctOpeningTitle" : "shift.rolloverTitle")} {...(isOpening ? {} : { description: t("shift.rolloverHelp") })}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="rd-v">{t(isOpening ? "shift.newValue" : "shift.rolloverValue")}</Label>
            <Input id="rd-v" inputMode="decimal" value={f.value} onChange={(e) => f.setValue(e.target.value)} className="h-12 text-lg tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rd-r">{t("shift.reason")}</Label>
            <Textarea id="rd-r" value={f.reason} onChange={(e) => f.setReason(e.target.value)} maxLength={300} />
          </div>
          {f.err && <p role="alert" className="text-sm text-destructive">{f.err}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!isOpening && reading.rollover_max !== null && <Button type="button" variant="outline" className="h-11" onClick={() => void submit(true)}>{t("shift.rolloverClear")}</Button>}
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" className="h-11">{t("common.save")}</Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}

function ClosedReadingDialog({ reading, label, onDone }: { reading: ShiftReading; label: string; onDone: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(String(reading.closing_reading));
  const [test, setTest] = useState(String(reading.test_litres));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = parseNum(closing), tl = parseNum(test);
    if (c === null || Number.isNaN(c) || c < 0 || tl === null || Number.isNaN(tl) || tl < 0) return setErr(t("validation.nonNegative"));
    if (reason.trim().length < 3) return setErr(t("validation.reasonMin"));
    const { error } = await supabase.rpc("correct_closed_reading", { _reading_id: reading.id, _closing: c, _test: tl, _reason: reason });
    if (error) return setErr(t(shiftErrorKey(error)));
    toast.success(t("shift.corrected"));
    setOpen(false);
    onDone();
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" aria-hidden />{t("shift.correct")} {label}</Button>
      <FormDialog open={open} onOpenChange={setOpen} title={`${t("shift.correctReadingTitle")} ${label}`}>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-1.5"><Label htmlFor="cr-c">{t("shift.closing")}</Label><Input id="cr-c" inputMode="decimal" value={closing} onChange={(e) => setClosing(e.target.value)} className="h-12 text-lg" /></div>
          <div className="space-y-1.5"><Label htmlFor="cr-t">{t("shift.test")}</Label><Input id="cr-t" inputMode="decimal" value={test} onChange={(e) => setTest(e.target.value)} className="h-12 text-lg" /></div>
          <div className="space-y-1.5"><Label htmlFor="cr-r">{t("shift.reason")}</Label><Textarea id="cr-r" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" className="h-11">{t("common.save")}</Button></div>
        </form>
      </FormDialog>
    </>
  );
}

function CollectionsDialog({ shift, onDone }: { shift: Shift; onDone: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<CollectionField, string>>(() => Object.fromEntries(COLLECTION_FIELDS.map((f) => [f, String(shift[f])])) as Record<CollectionField, string>);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nums = Object.fromEntries(COLLECTION_FIELDS.map((f) => [f, parseNum(v[f]) ?? 0]));
    if (Object.values(nums).some((n) => Number.isNaN(n) || n < 0)) return setErr(t("validation.nonNegative"));
    if (reason.trim().length < 3) return setErr(t("validation.reasonMin"));
    const { error } = await supabase.rpc("correct_closed_collections", { _shift_id: shift.id, _values: nums, _reason: reason });
    if (error) return setErr(t(shiftErrorKey(error)));
    toast.success(t("shift.corrected"));
    setOpen(false);
    onDone();
  }
  return (
    <>
      <Button variant="outline" className="h-11 w-full" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" aria-hidden />{t("shift.correctCollectionsTitle")}</Button>
      <FormDialog open={open} onOpenChange={setOpen} title={t("shift.correctCollectionsTitle")}>
        <form className="space-y-3" onSubmit={submit} noValidate>
          {COLLECTION_FIELDS.map((f) => (
            <div key={f} className="space-y-1.5"><Label htmlFor={`cc-${f}`}>{t(`shift.${f}` as TranslationKey)}</Label><Input id={`cc-${f}`} inputMode="decimal" value={v[f]} onChange={(e) => setV({ ...v, [f]: e.target.value })} className="h-11" /></div>
          ))}
          <div className="space-y-1.5"><Label htmlFor="cc-r">{t("shift.reason")}</Label><Textarea id="cc-r" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" className="h-11">{t("common.save")}</Button></div>
        </form>
      </FormDialog>
    </>
  );
}

function History({ corrections, person }: { corrections: { id: string; field: string; old_value: number | null; new_value: number | null; reason: string; created_at: string; created_by: string }[]; person: (id: string) => string }) {
  const t = useT();
  const label = (f: string) => (f.endsWith("_received") ? t(`shift.${f}` as TranslationKey) : t(`shift.field.${f}` as TranslationKey));
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 font-semibold">{t("shift.history")}</h3>
      {corrections.length === 0 ? <p className="text-sm text-muted-foreground">{t("shift.noHistory")}</p> : (
        <ul className="space-y-2 text-sm">
          {corrections.map((c) => (
            <li key={c.id} className="border-b pb-2 last:border-0">
              <span className="font-medium">{label(c.field)}</span>: {c.old_value === null ? "—" : L(Number(c.old_value))} → {c.new_value === null ? "—" : L(Number(c.new_value))}
              <span className="text-muted-foreground"> · {person(c.created_by)} · {new Date(c.created_at).toLocaleString("en-PK")} · {c.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
