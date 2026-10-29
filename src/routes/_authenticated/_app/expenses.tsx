import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { useStationCtx } from "@/components/setup/shared";
import { CategoriesDialog, catName, ExpenseDialog, ReverseButton } from "@/components/finance/dialogs";
import { DateRange, inRange, StatementActions } from "@/components/finance/statement";
import { useT, type TranslationKey } from "@/lib/i18n";
import { formatPKR } from "@/lib/setup";
import { peopleQuery, round2, todayKarachi } from "@/lib/shifts";
import { categoriesQuery, downloadCSV, expensesQuery, toCSV } from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — PumpHisab" },
      { name: "description", content: "Daily station expenses by category and payment method." },
      { property: "og:title", content: "Expenses — PumpHisab" },
      { property: "og:description", content: "Daily station expenses by category and payment method." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const t = useT();
  const { stationId, canEdit } = useStationCtx();
  const [e, c, p] = useSuspenseQueries({ queries: [expensesQuery(stationId), categoriesQuery(stationId), peopleQuery(stationId)] });
  const [from, setFrom] = useState(todayKarachi());
  const [to, setTo] = useState(todayKarachi());
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [d, setD] = useState<"add" | "cats" | null>(null);
  const cname = (id: string) => catName(t, c.data.find((x) => x.id === id)?.name ?? "—");
  const person = (id: string) => p.data.find((x) => x.user_id === id)?.full_name ?? "—";
  const s = q.trim().toLowerCase();
  const rows = e.data.filter((x) => inRange(x.occurred_at, from, to) && (cat === "all" || x.category_id === cat) && (!s || x.description.toLowerCase().includes(s) || (x.reference ?? "").toLowerCase().includes(s)));
  const liveRows = rows.filter((x) => !x.reversed_at);
  const sum = (m?: string) => round2(liveRows.filter((x) => !m || x.method === m).reduce((a, x) => a + Number(x.amount), 0));

  const csv = () => downloadCSV(`expenses-${from}-${to}.csv`, toCSV(
    [t("fin.date"), t("fin.category"), t("fin.description"), t("fin.amountPkr"), t("fin.paidFrom"), t("fin.receiptRef"), t("fin.recordedBy"), t("setup.status")],
    rows.map((x) => [x.occurred_at.slice(0, 16).replace("T", " "), cname(x.category_id), x.description, Number(x.amount), t(`fin.m.${x.method}` as TranslationKey), x.reference ?? "", person(x.created_by), x.reversed_at ? t("fin.reversedNote") : ""]),
  ));

  return (
    <>
      <PageHeader title={t("nav.expenses")} description={t("module.expenses.desc")} />
      <div className="mb-6 grid gap-2 sm:grid-cols-3 print:hidden">
        <Button size="lg" className="h-14 text-base" onClick={() => setD("add")}><Plus className="h-5 w-5" aria-hidden />{t("fin.qa.addExpense")}</Button>
        {canEdit && <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setD("cats")}><Tags className="h-5 w-5" aria-hidden />{t("fin.cat.title")}</Button>}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[["fin.exp.total", undefined], ["fin.m.drawer", "drawer"], ["fin.m.bank", "bank"], ["fin.m.other", "other"]].map(([k, m]) => (
          <div key={k} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{t(k as TranslationKey)}</p><p className="font-display text-2xl font-bold tabular-nums">{formatPKR(sum(m))}</p></div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-11 w-48" aria-label={t("fin.category")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("fin.allCategories")}</SelectItem>
              {c.data.map((x) => <SelectItem key={x.id} value={x.id}>{catName(t, x.name)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={t("setup.search")} aria-label={t("setup.search")} className="h-11 w-48" />
        </div>
        <StatementActions onCsv={csv} />
      </div>
      <DataTable
        rows={rows}
        rowKey={(x) => x.id}
        empty={<EmptyState title={t("fin.exp.empty")} />}
        columns={[
          { key: "d", header: t("fin.date"), cell: (x) => new Date(x.occurred_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }) },
          { key: "c", header: t("fin.category"), cell: (x) => cname(x.category_id) },
          { key: "s", header: t("fin.description"), cell: (x) => <span className={x.reversed_at ? "line-through text-muted-foreground" : ""}>{x.description}{x.reference && <span className="block text-xs text-muted-foreground">{x.reference}</span>}{x.reversed_at && <span className="block text-xs no-underline">{t("fin.reversedNote")}: {x.reversal_reason}</span>}</span> },
          { key: "m", header: t("fin.paidFrom"), cell: (x) => <Badge variant={x.method === "drawer" ? "default" : "secondary"}>{t(`fin.m.${x.method}` as TranslationKey)}</Badge> },
          { key: "b", header: t("fin.recordedBy"), cell: (x) => person(x.created_by) },
          { key: "a", header: t("fin.amountPkr"), className: "text-right", cell: (x) => <span className="font-semibold tabular-nums">{formatPKR(Number(x.amount))}</span> },
          { key: "r", header: "", className: "print:hidden", cell: (x) => (canEdit && !x.reversed_at ? <ReverseButton onReverse={(r) => supabase.rpc("reverse_expense", { _expense_id: x.id, _reason: r })} /> : null) },
        ]}
      />
      {d === "add" && <ExpenseDialog onClose={() => setD(null)} />}
      {d === "cats" && <CategoriesDialog onClose={() => setD(null)} />}
    </>
  );
}
