import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthShell } from "@/components/common/auth-shell";
import { FormField } from "@/components/common/form-field";
import { useI18n } from "@/lib/i18n";
import { stationSchema, type StationForm } from "@/lib/schemas";
import { myStationQuery } from "@/lib/station";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your station — PumpHisab" },
      { name: "description", content: "Create your petrol station in PumpHisab." },
      { property: "og:title", content: "Set up your station — PumpHisab" },
      { property: "og:description", content: "Create your petrol station in PumpHisab." },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const mine = await context.queryClient.fetchQuery(myStationQuery);
    if (mine) throw redirect({ to: "/dashboard" });
  },
  component: Onboarding,
});

function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useForm<StationForm>({
    resolver: zodResolver(stationSchema),
    defaultValues: { name: "", city: "", phone: "", language: lang },
  });
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.rpc("create_station_with_owner", {
      _name: v.name,
      _city: v.city,
      _phone: v.phone,
      _language: v.language,
    });
    if (error) {
      toast.error(error.message.includes("already_member") ? t("onboarding.already") : t("auth.genericError"));
      return;
    }
    setLang(v.language);
    await qc.invalidateQueries({ queryKey: myStationQuery.queryKey });
    toast.success(t("onboarding.success"));
    navigate({ to: "/dashboard" });
  });

  return (
    <AuthShell title={t("onboarding.title")} description={t("onboarding.desc")}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="name" label={t("onboarding.stationName")} placeholder={t("onboarding.stationNamePh")} registration={form.register("name")} error={e.name} />
        <FormField id="city" label={t("onboarding.city")} placeholder={t("onboarding.cityPh")} registration={form.register("city")} error={e.city} />
        <FormField id="phone" type="tel" inputMode="tel" label={t("onboarding.phone")} placeholder={t("onboarding.phonePh")} registration={form.register("phone")} error={e.phone} />
        <div className="space-y-1.5">
          <Label htmlFor="language">{t("onboarding.language")}</Label>
          <Controller
            control={form.control}
            name="language"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => { field.onChange(v); setLang(v as "en" | "ur"); }}>
                <SelectTrigger id="language" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t("lang.en")}</SelectItem>
                  <SelectItem value="ur">{t("lang.ur")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <Button type="submit" className="h-11 w-full text-base" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("common.saving") : t("onboarding.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
