import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/common/page";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ProductsStep } from "@/components/setup/products-step";
import { TanksStep } from "@/components/setup/tanks-step";
import { NozzlesStep } from "@/components/setup/nozzles-step";
import { PricesStep } from "@/components/setup/prices-step";
import { SuppliersStep } from "@/components/setup/suppliers-step";
import { useStationCtx } from "@/components/setup/shared";
import { SETUP_STEPS, useSetupData, type SetupStep } from "@/components/setup/use-setup-status";

const ALL = [...SETUP_STEPS, "review"] as const;
type Step = (typeof ALL)[number];

export const Route = createFileRoute("/_authenticated/_app/setup")({
  validateSearch: zodValidator(z.object({ step: fallback(z.string(), "products").default("products") })),
  head: () => ({
    meta: [
      { title: "Station Setup — Al-Ghani Station" },
      { name: "description", content: "Set up fuel products, tanks, nozzles, prices and suppliers step by step." },
      { property: "og:title", content: "Station Setup — Al-Ghani Station" },
      { property: "og:description", content: "Set up fuel products, tanks, nozzles, prices and suppliers step by step." },
    ],
  }),
  component: SetupPage,
});

const labelKey = (s: Step) => `setup.step.${s}` as TranslationKey;

function SetupPage() {
  const t = useT();
  const navigate = useNavigate({ from: "/setup" });
  const { step: raw } = Route.useSearch();
  const step: Step = (ALL as readonly string[]).includes(raw) ? (raw as Step) : "products";
  const idx = ALL.indexOf(step);
  const { stationId, canEdit } = useStationCtx();
  const { status } = useSetupData(stationId);
  const doneCount = SETUP_STEPS.filter((s) => status[s]).length;
  const go = (s: Step) => navigate({ search: { step: s } });

  return (
    <>
      <PageHeader title={t("setup.title")} description={t("setup.desc")} />
      {!canEdit && <p className="mb-4 rounded-lg bg-secondary p-3 text-sm">{t("setup.readOnly")}</p>}

      <nav aria-label={t("setup.title")} className="mb-6 rounded-2xl border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">{t("setup.stepOf", { n: idx + 1, total: ALL.length })}</span>
          <span className="text-muted-foreground">{t("dashboard.setupProgress", { pct: Math.round((doneCount / SETUP_STEPS.length) * 100) })}</span>
        </div>
        <Progress value={(doneCount / SETUP_STEPS.length) * 100} className="mb-4 h-2" />
        <ol className="flex gap-2 overflow-x-auto pb-1">
          {ALL.map((s, i) => {
            const done = s !== "review" && status[s as SetupStep];
            return (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(s)}
                  aria-current={s === step ? "step" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                    s === step ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {done ? <CheckCircle2 className={cn("h-4 w-4", s === step ? "" : "text-success")} aria-hidden /> : <span className="flex h-4 w-4 items-center justify-center text-xs font-bold">{i + 1}</span>}
                  {t(labelKey(s))}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="step-title">
        <h2 id="step-title" className="mb-4 text-xl font-semibold">{t(labelKey(step))}</h2>
        {step === "products" && <ProductsStep />}
        {step === "tanks" && <TanksStep />}
        {step === "nozzles" && <NozzlesStep />}
        {step === "prices" && <PricesStep />}
        {step === "suppliers" && <SuppliersStep />}
        {step === "review" && <Review onEdit={go} />}
      </section>

      <div className="mt-8 flex justify-between gap-2">
        <Button variant="outline" className="h-11" disabled={idx === 0} onClick={() => go(ALL[idx - 1]!)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("setup.prev")}
        </Button>
        {idx < ALL.length - 1 && (
          <Button className="h-11" onClick={() => go(ALL[idx + 1]!)}>
            {t("setup.next")}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </>
  );
}

function Review({ onEdit }: { onEdit: (s: Step) => void }) {
  const t = useT();
  const { stationId } = useStationCtx();
  const d = useSetupData(stationId);
  const counts: Record<SetupStep, number> = {
    products: d.products.filter((p) => p.is_active).length,
    tanks: d.tanks.filter((x) => x.is_active).length,
    nozzles: d.nozzles.filter((n) => n.is_active).length,
    prices: d.prices.length,
    suppliers: d.suppliers.filter((s) => s.is_active).length,
  };
  const allDone = SETUP_STEPS.every((s) => d.status[s]);
  return (
    <div>
      <p className="mb-4 text-muted-foreground">{t("review.desc")}</p>
      {allDone && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success/15 p-4">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-success" aria-hidden />{t("review.complete")}</p>
          <Button asChild className="h-11"><Link to="/dashboard">{t("review.goDashboard")}</Link></Button>
        </div>
      )}
      <ul className="divide-y rounded-xl border bg-card">
        {SETUP_STEPS.map((s) => (
          <li key={s}>
            <button type="button" onClick={() => onEdit(s)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted">
              {d.status[s] ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <Circle className="h-5 w-5 text-muted-foreground" aria-hidden />}
              <span className="flex-1 font-medium">{t(labelKey(s))}</span>
              <span className={cn("text-sm", d.status[s] ? "text-muted-foreground" : "text-warning-foreground")}>
                {d.status[s] ? t("review.count", { n: counts[s] }) : t("review.missing")}
              </span>
              <Pencil className="h-4 w-4 text-muted-foreground" aria-label={t("setup.edit")} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
