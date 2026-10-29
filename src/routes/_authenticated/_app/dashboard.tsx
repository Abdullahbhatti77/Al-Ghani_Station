import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { PageHeader, StatCard } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { useT, type TranslationKey } from "@/lib/i18n";
import { myStationQuery } from "@/lib/station";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Today's summary — PumpHisab" },
      { name: "description", content: "Your petrol station's daily summary and setup checklist." },
      { property: "og:title", content: "Today's summary — PumpHisab" },
      { property: "og:description", content: "Your petrol station's daily summary and setup checklist." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const t = useT();
  const { data } = useSuspenseQuery(myStationQuery);
  const station = data!.station;

  // Only the station profile exists in this foundation step; other steps
  // become "done" once their modules store real records.
  const steps: { key: TranslationKey; done: boolean; to?: "/settings" | "/fuel-stock" | "/shifts" }[] = [
    { key: "dashboard.step.station", done: true, to: "/settings" },
    { key: "dashboard.step.tanks", done: false, to: "/fuel-stock" },
    { key: "dashboard.step.prices", done: false, to: "/fuel-stock" },
    { key: "dashboard.step.staff", done: false, to: "/settings" },
    { key: "dashboard.step.shift", done: false, to: "/shifts" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const incomplete = doneCount < steps.length;

  // No business records exist yet: every figure is null (shown as "No data yet"), never a fake number.
  const stats: { key: TranslationKey; value: string | null }[] = [
    { key: "dashboard.todaySales", value: null },
    { key: "dashboard.fuelLitres", value: null },
    { key: "dashboard.udhaar", value: null },
    { key: "dashboard.expenses", value: null },
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
          <ul className="mt-4 divide-y">
            {steps.map((s) => (
              <li key={s.key}>
                <Link to={s.to ?? "/dashboard"} className="flex min-h-12 items-center gap-3 py-2 hover:text-primary">
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
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.key} label={t(s.key)} value={s.value} emptyLabel={t("common.noData")} hint={t("dashboard.noDataHint")} storedLabel={t("common.stored")} />
        ))}
      </div>
    </>
  );
}
