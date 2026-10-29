import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Fuel } from "lucide-react";
import { LanguageSelect } from "./language-select";
import { useT } from "@/lib/i18n";

export function Brand() {
  const t = useT();
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
        <Fuel className="h-5 w-5" aria-hidden />
      </span>
      {t("app.name")}
    </Link>
  );
}

export function AuthShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Brand />
        <LanguageSelect />
      </header>
      <main className="mx-auto flex max-w-md flex-col px-4 pb-16 pt-6 sm:pt-12">
        <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
