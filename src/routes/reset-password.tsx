import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/common/auth-shell";
import { PasswordField } from "@/components/common/password-field";
import { authErrorMessage } from "@/lib/auth-errors";
import { LoadingState } from "@/components/common/states";
import { useT } from "@/lib/i18n";
import { passwordSchema } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Al-Ghani Station" },
      { name: "description", content: "Choose a new Al-Ghani Station password." },
      { property: "og:title", content: "Reset password — Al-Ghani Station" },
      { property: "og:description", content: "Choose a new Al-Ghani Station password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const t = useT();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setState("ready");
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && isRecovery) setState("ready");
      else if (!isRecovery) setState("invalid");
    });
    const timer = window.setTimeout(() => setState((cur) => (cur === "checking" ? "invalid" : cur)), 4000);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const form = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password: passwordSchema })) });
  const onSubmit = form.handleSubmit(async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(authErrorMessage(error, t)); return; }
    toast.success(t("auth.passwordUpdated"));
    navigate({ to: "/dashboard" });
  });

  return (
    <AuthShell title={t("auth.resetTitle")}>
      {state === "checking" && <LoadingState />}
      {state === "invalid" && (
        <div className="space-y-4">
          <p role="alert" className="text-destructive">{t("auth.resetInvalid")}</p>
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">{t("auth.forgotTitle")}</Link>
        </div>
      )}
      {state === "ready" && (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <PasswordField id="password" label={t("auth.newPassword")} registration={form.register("password")} error={form.formState.errors.password} autoComplete="new-password" />
          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>{t("auth.updatePassword")}</Button>
        </form>
      )}
    </AuthShell>
  );
}
