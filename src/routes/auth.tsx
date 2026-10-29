import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/common/auth-shell";
import { FormField } from "@/components/common/form-field";
import { useT } from "@/lib/i18n";
import { emailSchema, passwordSchema } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";

const search = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in — PumpHisab" },
      { name: "description", content: "Sign in or create your PumpHisab owner account." },
      { property: "og:title", content: "Sign in — PumpHisab" },
      { property: "og:description", content: "Sign in or create your PumpHisab owner account." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "validation.required") });
const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "validation.min2").max(100),
  email: emailSchema,
  password: passwordSchema,
});

function AuthPage() {
  const t = useT();
  const navigate = useNavigate();
  const { mode = "signin" } = Route.useSearch();
  const isSignUp = mode === "signup";
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const form = useForm<{ fullName?: string; email: string; password: string }>({
    resolver: zodResolver(isSignUp ? signUpSchema : signInSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (v) => {
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
        options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: v.fullName } },
      });
      if (error) { toast.error(t("auth.genericError")); return; }
      if (data.session) navigate({ to: "/dashboard" });
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
      if (error) { toast.error(t("auth.invalid")); return; }
      navigate({ to: "/dashboard" });
    }
  });

  const e = form.formState.errors;
  return (
    <AuthShell title={t(isSignUp ? "auth.signUpTitle" : "auth.signInTitle")} description={t("app.tagline")}>
      {sent ? (
        <p role="status" className="rounded-lg bg-accent p-4 text-accent-foreground">{t("auth.checkEmail")}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {isSignUp && (
            <FormField id="fullName" label={t("auth.fullName")} registration={form.register("fullName")} error={e.fullName} autoComplete="name" />
          )}
          <FormField id="email" type="email" label={t("auth.email")} registration={form.register("email")} error={e.email} autoComplete="email" />
          <FormField
            id="password"
            type="password"
            label={t("auth.password")}
            registration={form.register("password")}
            error={e.password}
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
          <Button type="submit" className="h-11 w-full text-base" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("common.loading") : t(isSignUp ? "auth.signUp" : "auth.signIn")}
          </Button>
        </form>
      )}
      <div className="mt-6 flex flex-col gap-2 text-sm">
        {!isSignUp && (
          <Link to="/forgot-password" className="text-primary hover:underline">{t("auth.forgot")}</Link>
        )}
        <Link
          to="/auth"
          search={{ mode: isSignUp ? "signin" : "signup" }}
          onClick={() => setSent(false)}
          className="text-primary hover:underline"
        >
          {t(isSignUp ? "auth.toSignIn" : "auth.toSignUp")}
        </Link>
      </div>
    </AuthShell>
  );
}
