import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/common/auth-shell";
import { LanguageSelect } from "@/components/common/language-select";
import { useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Al-Ghani Station — Simple petrol pump accounts" },
      { name: "description", content: "Shifts, fuel stock, udhaar and expenses for Pakistani petrol pumps, in English or Roman Urdu." },
      { property: "og:title", content: "Al-Ghani Station — Simple petrol pump accounts" },
      { property: "og:description", content: "Shifts, fuel stock, udhaar and expenses for Pakistani petrol pumps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const t = useT();
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Brand />
        <div className="flex items-center gap-2">
          <LanguageSelect className="w-[140px]" />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/auth">{t("landing.signIn")}</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-20">
        <div className="overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-primary-foreground sm:px-14 sm:py-20">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">{t("landing.title")}</h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">{t("landing.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
              <Link to="/auth" search={{ mode: "signup" }}>{t("landing.cta")}</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 px-6 text-base hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/auth">{t("landing.signIn")}</Link>
            </Button>
          </div>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {(["landing.f1", "landing.f2", "landing.f3"] as const).map((k) => (
            <li key={k} className="flex items-start gap-3 rounded-xl border bg-card p-5 shadow-card">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
              <span className="font-medium">{t(k)}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
