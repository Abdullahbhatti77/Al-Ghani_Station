import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQueries } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, CreditCard, HandCoins, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { formatPKR } from "@/lib/setup";
import type { Collections, Shift } from "@/lib/shifts";
import { cashMovesQuery, customersQuery, customerTxnsQuery, drawerExpected, expensesQuery, salesCollection, shiftLinked, statusOf, type Status } from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";
import { CashMoveDialog, CreditSaleDialog, ExpenseDialog, PaymentDialog, ReverseButton } from "./dialogs";

export function useShiftMoney(stationId: string, shiftId: string) {
  const [x, e, m, c] = useSuspenseQueries({ queries: [customerTxnsQuery(stationId), expensesQuery(stationId), cashMovesQuery(stationId), customersQuery(stationId)] });
  const txns = x.data.filter((r) => r.shift_id === shiftId);
  const expenses = e.data.filter((r) => r.shift_id === shiftId);
  const moves = m.data.filter((r) => r.shift_id === shiftId);
  return { txns, expenses, moves, customers: c.data, linked: shiftLinked(txns, expenses, moves) };
}

export function computeClosing(shift: Shift, totalSales: number, coll: Collections, float: number, counted: number | null, linked: ReturnType<typeof shiftLinked>) {
  const sales = salesCollection(totalSales, coll, linked.creditSales);
  const expected = drawerExpected({ float, cashFuel: Number(coll.cash_received) || 0, ...linked });
  const cashDiff = counted === null ? null : Math.round((counted - expected) * 100) / 100;
  return { sales, expected, cashDiff, cashStatus: cashDiff === null ? null : statusOf(cashDiff) };
}

function Row({ label, value, sign, strong }: { label: string; value: number; sign?: "+" | "−"; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 py-1.5", strong && "border-t pt-2 font-semibold")}>
      <span className="text-muted-foreground">{sign && <span className="mr-1 font-mono">{sign}</span>}{label}</span>
      <span className="tabular-nums">{formatPKR(value)}</span>
    </div>
  );
}

export function VarianceBadge({ status, diff }: { status: Status | null; diff: number | null }) {
  const t = useT();
  if (status === null || diff === null) return <span className="text-muted-foreground">{t("fin.close.notCounted")}</span>;
  if (status === "matched") return <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-5 w-5" aria-hidden />{t("shift.matched")}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1", status === "short" ? "text-destructive" : "text-warning-foreground")}>
      <AlertTriangle className="h-5 w-5" aria-hidden />{t(status === "short" ? "shift.short" : "shift.excess", { v: formatPKR(Math.abs(diff)) })}
    </span>
  );
}

function Panel({ n, title, status, children }: { n: number; title: string; status: Status | null; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border-2 bg-card p-4", status === "matched" ? "border-success/60" : status ? "border-warning" : "border-border")}>
      <h3 className="mb-2 flex items-center gap-2 font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>{title}</h3>
      {children}
    </section>
  );
}

/** Three separate checks: fuel sales collection, drawer cash, and fuel stock (dips). Values are never changed to force a match. */
export function ClosingPanels({ shift, stationId, totalSales, coll, float, counted, closed }: { shift: Shift; stationId: string; totalSales: number; coll: Collections; float: number; counted: number | null; closed: boolean }) {
  const t = useT();
  const money = useShiftMoney(stationId, shift.id);
  const linked = closed
    ? { creditSales: Number(shift.credit_sales), cashRepayments: Number(shift.cash_repayments), drawerExpenses: Number(shift.drawer_expenses), cashIn: Number(shift.cash_in), cashOut: Number(shift.cash_out) }
    : money.linked;
  const r = computeClosing(shift, totalSales, coll, float, counted, linked);
  const digital = Number(coll.bank_received) + Number(coll.card_received) + Number(coll.wallet_received) + Number(coll.other_received);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel n={1} title={t("fin.close.p1")} status={r.sales.status}>
        <Row label={t("fin.close.meterSales")} value={totalSales} strong />
        <Row label={t("fin.close.cashFuel")} value={Number(coll.cash_received)} sign="+" />
        <Row label={t("fin.close.digital")} value={digital} sign="+" />
        <Row label={t("fin.close.credit")} value={r.sales.creditSales} sign="+" />
        <Row label={t("fin.close.accounted")} value={r.sales.accounted} strong />
        <p className="mt-2 text-lg font-semibold"><VarianceBadge status={r.sales.status} diff={r.sales.difference} /></p>
      </Panel>
      <Panel n={2} title={t("fin.close.p2")} status={r.cashStatus}>
        <Row label={t("shift.float")} value={float} />
        <Row label={t("fin.close.cashFuel")} value={Number(coll.cash_received)} sign="+" />
        <Row label={t("fin.close.cashRepay")} value={linked.cashRepayments} sign="+" />
        <Row label={t("fin.close.cashIn")} value={linked.cashIn} sign="+" />
        <Row label={t("fin.close.drawerExp")} value={linked.drawerExpenses} sign="−" />
        <Row label={t("fin.close.cashOut")} value={linked.cashOut} sign="−" />
        <Row label={t("fin.close.expected")} value={r.expected} strong />
        {counted !== null && <Row label={t("fin.close.counted")} value={counted} />}
        <p className="mt-2 text-lg font-semibold"><VarianceBadge status={r.cashStatus} diff={r.cashDiff} /></p>
      </Panel>
      <Panel n={3} title={t("fin.close.p3")} status={null}>
        <p className="text-sm text-muted-foreground">{t("fin.close.p3Body")}</p>
        <Button asChild variant="outline" className="mt-3 h-11"><Link to="/fuel-stock">{t("fin.close.openStock")}</Link></Button>
      </Panel>
    </div>
  );
}

type D = "sale" | "pay" | "exp" | "in" | "out" | null;
/** Actions + list of everything linked to this shift's drawer. */
export function ShiftLinkedRecords({ shift, stationId, closed }: { shift: Shift; stationId: string; closed: boolean }) {
  const t = useT();
  const [d, setD] = useState<D>(null);
  const money = useShiftMoney(stationId, shift.id);
  const cname = (id: string) => money.customers.find((c) => c.id === id)?.name ?? "—";
  type Item = { id: string; at: string; label: string; amount: number; reversed: boolean; undo?: (r: string) => PromiseLike<{ error: { message?: string } | null }> };
  const items: Item[] = [
    ...money.txns.map((x) => ({
      id: x.id, at: x.created_at, amount: Number(x.amount), reversed: !!x.reversed_at,
      label: `${t(x.kind === "credit_sale" ? "fin.k.credit_sale" : "fin.k.payment")} · ${cname(x.customer_id)}${x.method ? ` · ${t(`fin.m.${x.method}` as "fin.m.cash")}` : ""}`,
      undo: (r: string) => supabase.rpc("reverse_customer_txn", { _txn_id: x.id, _reason: r }),
    })),
    ...money.expenses.map((x) => ({ id: x.id, at: x.created_at, amount: Number(x.amount), reversed: !!x.reversed_at, label: `${t("fin.k.expense")} · ${x.description}`, undo: (r: string) => supabase.rpc("reverse_expense", { _expense_id: x.id, _reason: r }) })),
    ...money.moves.map((x) => ({ id: x.id, at: x.created_at, amount: Number(x.amount), reversed: !!x.reversed_at, label: `${t(x.kind === "cash_in" ? "fin.cash.inTitle" : "fin.cash.outTitle")} · ${x.reason}`, undo: () => supabase.rpc("reverse_shift_cash_movement", { _id: x.id }) })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="font-semibold">{t("fin.close.linked")}</h3>
      {!closed && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Button variant="outline" className="h-12" onClick={() => setD("sale")}><CreditCard className="h-4 w-4" aria-hidden />{t("fin.qa.creditSale")}</Button>
          <Button variant="outline" className="h-12" onClick={() => setD("pay")}><HandCoins className="h-4 w-4" aria-hidden />{t("fin.qa.receivePayment")}</Button>
          <Button variant="outline" className="h-12" onClick={() => setD("exp")}><Receipt className="h-4 w-4" aria-hidden />{t("fin.qa.addExpense")}</Button>
          <Button variant="outline" className="h-12" onClick={() => setD("in")}><ArrowDownToLine className="h-4 w-4" aria-hidden />{t("fin.cash.inTitle")}</Button>
          <Button variant="outline" className="h-12" onClick={() => setD("out")}><ArrowUpFromLine className="h-4 w-4" aria-hidden />{t("fin.cash.outTitle")}</Button>
        </div>
      )}
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{t("fin.close.noLinked")}</p> : (
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className={cn("flex items-center justify-between gap-2 py-2", i.reversed && "text-muted-foreground line-through")}>
              <span>{i.label}</span>
              <span className="flex items-center gap-1 tabular-nums">{formatPKR(i.amount)}{!closed && !i.reversed && i.undo && <ReverseButton onReverse={i.undo} />}</span>
            </li>
          ))}
        </ul>
      )}
      {d === "sale" && <CreditSaleDialog shiftId={shift.id} onClose={() => setD(null)} />}
      {d === "pay" && <PaymentDialog shiftId={shift.id} onClose={() => setD(null)} />}
      {d === "exp" && <ExpenseDialog shiftId={shift.id} onClose={() => setD(null)} />}
      {(d === "in" || d === "out") && <CashMoveDialog shiftId={shift.id} kind={d === "in" ? "cash_in" : "cash_out"} onClose={() => setD(null)} />}
    </div>
  );
}
