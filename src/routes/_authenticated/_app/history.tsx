import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStationCtx } from "@/components/setup/shared";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { formatPKR, formatNumber } from "@/lib/setup";
import { peopleQuery } from "@/lib/shifts";
import { auditQuery, karachiDate } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/_app/history")({
  head: () => ({
    meta: [
      { title: "Activity history — Al-Ghani Station" },
      { name: "description", content: "Who closed shifts, changed prices, approved adjustments and reversed records at your station." },
      { property: "og:title", content: "Activity history — Al-Ghani Station" },
      { property: "og:description", content: "Who closed shifts, changed prices, approved adjustments and reversed records at your station." },
    ],
  }),
  component: HistoryPage,
});

const ACTIONS = [
  "price_set", "shift_closed", "shift_corrected", "adjustment_requested", "adjustment_approved", "adjustment_rejected",
  "credit_override", "customer_txn_reversed", "supplier_paid", "supplier_payment_reversed", "expense_reversed",
  "delivery_reversed", "cash_movement_reversed", "settings_changed", "member_added", "member_removed", "role_changed",
] as const;

const MONEY = new Set(["amount", "price", "sales", "difference", "cash_variance"]);
const LITRE = new Set(["litres"]);

function HistoryPage() {
  const { t, lang } = useI18n();
  const { stationId, can } = useStationCtx();
  const allowed = can("history.view");
  const q = useQuery({ ...auditQuery(stationId), enabled: allowed });
  const people = useQuery({ ...peopleQuery(stationId), enabled: allowed });
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  if (!allowed)
    return (
      <>
        <PageHeader title={t("hist.title")} />
        <EmptyState icon={<Lock className="h-6 w-6" aria-hidden />} title={t("rep.noAccess")} body={t("rep.noAccessBody")} />
      </>
    );

  const who = (id: string | null) => (id ? people.data?.find((p) => p.user_id === id)?.full_name ?? id.slice(0, 8) : t("hist.system"));
  const label = (a: string) => ((ACTIONS as readonly string[]).includes(a) ? t(`hist.a.${a}` as TranslationKey) : a);
  const detail = (d: Record<string, unknown>) =>
    Object.entries(d)
      .filter(([k, v]) => v !== null && v !== undefined && typeof v !== "object" && !k.endsWith("_id"))
      .map(([k, v]) => `${k}: ${MONEY.has(k) ? formatPKR(Number(v)) : LITRE.has(k) ? `${formatNumber(Number(v), 2)} L` : String(v)}`)
      .join(" · ");
  const changed = (d: Record<string, unknown>) => {
    const b = d["before"] as Record<string, unknown> | undefined;
    const a = d["after"] as Record<string, unknown> | undefined;
    if (!a || !b) return "";
    return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k}: ${String(b[k] ?? "—")} → ${String(a[k] ?? "—")}`).join(" · ");
  };

  const rows = (q.data ?? []).filter((r) => (type === "all" || r.action === type) && (!from || karachiDate(r.created_at) >= from) && (!to || karachiDate(r.created_at) <= to));

  return (
    <>
      <PageHeader title={t("hist.title")} description={t("hist.desc")} />
      <p className="mb-4 flex gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground"><ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />{t("hist.note")}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="h-type">{t("hist.type")}</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="h-type" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hist.all")}</SelectItem>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{label(a)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="h-from">{t("rep.from")}</Label><Input id="h-from" type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="h-to">{t("rep.to")}</Label><Input id="h-to" type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {q.isPending ? <LoadingState /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <EmptyState title={t("hist.empty")} />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const d = (r.details ?? {}) as Record<string, unknown>;
            const info = r.action === "settings_changed" ? changed(d) : detail(d);
            return (
              <li key={r.id} className="rounded-xl border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{label(r.action)}</p>
                  <time className="text-sm text-muted-foreground" dateTime={r.created_at}>
                    {new Date(r.created_at).toLocaleString(lang === "ur" ? "en-PK" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" })}
                  </time>
                </div>
                <p className="text-sm"><span className="text-muted-foreground">{t("hist.who")}:</span> {who(r.actor_id)}</p>
                {r.reason && <p className="text-sm"><span className="text-muted-foreground">{t("hist.reason")}:</span> {r.reason}</p>}
                {info && <p className="mt-1 break-words text-sm text-muted-foreground">{info}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
