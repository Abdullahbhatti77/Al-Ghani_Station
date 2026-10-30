import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/common/auth-shell";
import { FormField } from "@/components/common/form-field";
import { useT } from "@/lib/i18n";
import { emailSchema } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Al-Ghani Station" },
      { name: "description", content: "Request a Al-Ghani Station password reset link." },
      { property: "og:title", content: "Forgot password — Al-Ghani Station" },
      { property: "og:description", content: "Request a Al-Ghani Station password reset link." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const t = useT();
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: emailSchema })) });
  const onSubmit = form.handleSubmit(async ({ email }) => {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setSent(true);
  });
  return (
    <AuthShell title={t("auth.forgotTitle")} description={t("auth.forgotDesc")}>
      {sent ? (
        <p role="status" className="rounded-lg bg-accent p-4 text-accent-foreground">{t("auth.linkSent")}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="email" type="email" label={t("auth.email")} registration={form.register("email")} error={form.formState.errors.email} />
          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>{t("auth.sendLink")}</Button>
        </form>
      )}
      <Link to="/auth" className="mt-6 inline-block text-sm text-primary hover:underline">{t("auth.toSignIn")}</Link>
    </AuthShell>
  );
}
