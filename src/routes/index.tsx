import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Banknote, BarChart3, CheckCircle2, Droplets, Gauge, Languages, Lock, ShieldCheck, Truck, Users, Wallet, XCircle, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Brand } from "@/components/common/auth-shell";
import { LanguageSelect } from "@/components/common/language-select";
import { useT, type TranslationKey } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Al-Ghani Station — Simple petrol pump accounts" },
      { name: "description", content: "Shifts, fuel stock, udhaar, supplier payables and expenses for Pakistani petrol pumps, in English or Roman Urdu." },
      { property: "og:title", content: "Al-Ghani Station — Simple petrol pump accounts" },
      { property: "og:description", content: "Shifts, fuel stock, udhaar and expenses for Pakistani petrol pumps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES: { icon: typeof Gauge; k: string }[] = [
  { icon: Gauge, k: "shifts" }, { icon: Droplets, k: "stock" }, { icon: Users, k: "udhaar" }, { icon: Truck, k: "suppliers" },
  { icon: Wallet, k: "cash" }, { icon: BarChart3, k: "reports" }, { icon: History, k: "roles" }, { icon: Languages, k: "lang" },
];

function Landing() {
  const t = useT();
  const tk = (k: string) => t(k as TranslationKey);
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Brand />
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">{t("landing.nav.features")}</a>
            <a href="#how" className="hover:text-foreground">{t("landing.nav.how")}</a>
            <a href="#faq" className="hover:text-foreground">{t("landing.nav.faq")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSelect className="w-[130px]" />
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/auth">{t("landing.signIn")}</Link></Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">{t("landing.badge")}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">{t("landing.title")}</h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t("landing.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base"><Link to="/auth" search={{ mode: "signup" }}>{t("landing.cta")}</Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base"><Link to="/auth">{t("landing.signIn")}</Link></Button>
            </div>
          </div>
          <div className="rounded-3xl bg-brand-gradient p-5 text-primary-foreground shadow-card sm:p-7">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">{t("landing.preview.title")}</p>
              <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs">{t("landing.example")}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {([["landing.preview.sales", "Rs 4,85,300"], ["landing.preview.litres", "1,828 L"], ["landing.preview.udhaar", "Rs 62,400"], ["landing.preview.cash", "Rs 3,92,150"]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-primary-foreground/10 p-4">
                  <p className="text-sm opacity-80">{t(k)}</p>
                  <p className="mt-1 font-display text-2xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-primary-foreground/10 p-4">
              <div className="flex justify-between text-sm"><span>{t("landing.preview.stock")}</span><span>68%</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full w-[68%] rounded-full bg-success" /></div>
            </div>
          </div>
        </section>

        {/* Before / after */}
        <section className="bg-muted/50 py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold">{t("landing.problem.title")}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-card p-6">
                <p className="font-semibold text-muted-foreground">{t("landing.problem.before")}</p>
                <ul className="mt-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i} className="flex gap-3"><XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />{tk(`landing.problem.b${i}`)}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-card">
                <p className="font-semibold text-primary">{t("landing.problem.after")}</p>
                <ul className="mt-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />{tk(`landing.problem.a${i}`)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <h2 className="text-center text-3xl font-bold">{t("landing.features.title")}</h2>
          <p className="mt-2 text-center text-muted-foreground">{t("landing.features.sub")}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, k }) => (
              <div key={k} className="rounded-2xl border bg-card p-5 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="mt-4 font-semibold">{tk(`landing.ft.${k}`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tk(`landing.ft.${k}D`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-muted/50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold">{t("landing.how.title")}</h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <li key={i} className="rounded-2xl border bg-card p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">{i}</span>
                  <h3 className="mt-4 font-semibold">{tk(`landing.how.s${i}`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tk(`landing.how.s${i}D`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Roles + trust */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">{t("landing.roles.title")}</h2>
            <div className="mt-6 space-y-3">
              {["owner", "manager", "attendant"].map((r) => (
                <div key={r} className="rounded-xl border bg-card p-4">
                  <p className="font-semibold">{tk(`landing.roles.${r}`)}</p>
                  <p className="text-sm text-muted-foreground">{tk(`landing.roles.${r}D`)}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold">{t("landing.trust.title")}</h2>
            <ul className="mt-6 space-y-3">
              {([[Lock, 1], [ShieldCheck, 2], [Banknote, 3]] as const).map(([Icon, i]) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className="font-medium">{tk(`landing.trust.t${i}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-16">
          <h2 className="text-center text-3xl font-bold">{t("landing.faq.title")}</h2>
          <Accordion type="single" collapsible className="mt-6">
            {[1, 2, 3, 4].map((i) => (
              <AccordionItem key={i} value={`q${i}`}>
                <AccordionTrigger className="text-left">{tk(`landing.faq.q${i}`)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{tk(`landing.faq.a${i}`)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-3xl bg-brand-gradient px-6 py-12 text-center text-primary-foreground sm:px-14">
            <h2 className="text-3xl font-bold">{t("landing.final.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl opacity-90">{t("landing.final.sub")}</p>
            <Button asChild size="lg" variant="secondary" className="mt-6 h-12 px-6 text-base">
              <Link to="/auth" search={{ mode: "signup" }}>{t("landing.cta")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <Brand />
          <p>© {new Date().getFullYear()} {t("app.name")} — {t("landing.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
