import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, DataTable } from "@/components/common/page";
import { FormField } from "@/components/common/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { useI18n } from "@/lib/i18n";
import { stationSchema, type StationForm } from "@/lib/schemas";
import { myStationQuery, stationMembersQuery } from "@/lib/station";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PumpHisab" },
      { name: "description", content: "Manage your station details and members." },
      { property: "og:title", content: "Settings — PumpHisab" },
      { property: "og:description", content: "Manage your station details and members." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, setLang } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(myStationQuery);
  const { station, role } = data!;
  const canEdit = role === "owner" || role === "manager";
  const { user } = Route.useRouteContext();

  const form = useForm<StationForm>({
    resolver: zodResolver(stationSchema),
    defaultValues: {
      name: station.name,
      city: station.city,
      phone: station.contact_phone,
      language: station.preferred_language === "ur" ? "ur" : "en",
    },
  });
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase
      .from("stations")
      .update({ name: v.name, city: v.city, contact_phone: v.phone, preferred_language: v.language })
      .eq("id", station.id);
    if (error) { toast.error(t("auth.genericError")); return; }
    await supabase.from("profiles").update({ preferred_language: v.language }).eq("id", user.id);
    setLang(v.language);
    await qc.invalidateQueries({ queryKey: myStationQuery.queryKey });
    toast.success(t("settings.saved"));
  });

  const members = useQuery(stationMembersQuery(station.id));

  return (
    <>
      <PageHeader title={t("settings.title")} actions={<Badge variant="secondary">{t("settings.role")}: {t(`role.${role}`)}</Badge>} />

      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-lg font-semibold">{t("settings.station")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{canEdit ? t("settings.stationDesc") : t("settings.readOnly")}</p>
        <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
          <fieldset disabled={!canEdit} className="contents">
            <FormField id="name" label={t("onboarding.stationName")} registration={form.register("name")} error={e.name} />
            <FormField id="city" label={t("onboarding.city")} registration={form.register("city")} error={e.city} />
            <FormField id="phone" type="tel" label={t("onboarding.phone")} registration={form.register("phone")} error={e.phone} />
            <div className="space-y-1.5">
              <Label htmlFor="language">{t("onboarding.language")}</Label>
              <Controller
                control={form.control}
                name="language"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
                    <SelectTrigger id="language" className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("lang.en")}</SelectItem>
                      <SelectItem value="ur">{t("lang.ur")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </fieldset>
          {canEdit && (
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" className="h-11 px-6" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => form.reset()}>
                {t("common.cancel")}
              </Button>
            </div>
          )}
        </form>
      </section>

      <ThresholdSection stationId={station.id} value={station.dip_variance_litres} canEdit={canEdit} />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{t("settings.members")}</h2>
        {members.isPending ? (
          <LoadingState />
        ) : members.isError ? (
          <ErrorState onRetry={() => members.refetch()} />
        ) : (
          <DataTable
            rows={members.data}
            rowKey={(r) => r.id}
            empty={<EmptyState title={t("common.noData")} />}
            columns={[
              { key: "m", header: t("settings.memberCol"), cell: (r) => (r.user_id === user.id ? t("settings.you") : r.user_id.slice(0, 8)) },
              { key: "r", header: t("settings.roleCol"), cell: (r) => <Badge variant="secondary">{t(`role.${r.role}`)}</Badge> },
              { key: "j", header: t("settings.joinedCol"), cell: (r) => new Date(r.created_at).toLocaleDateString() },
            ]}
          />
        )}
      </section>
    </>
  );
}

function ThresholdSection({ stationId, value, canEdit }: { stationId: string; value: number | null; canEdit: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [v, setV] = useState(value === null ? "" : String(value));
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = v.trim() === "" ? null : Number(v);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return void toast.error(t("validation.nonNegative"));
    setBusy(true);
    const { error } = await supabase.from("stations").update({ dip_variance_litres: n }).eq("id", stationId);
    setBusy(false);
    if (error) return void toast.error(t("auth.genericError"));
    await qc.invalidateQueries({ queryKey: myStationQuery.queryKey });
    toast.success(t("settings.saved"));
  }
  return (
    <section className="mt-8 rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold">{t("inv.thresholdTitle")}</h2>
      <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="dip-th">{t("inv.threshold")}</Label>
          <Input id="dip-th" inputMode="decimal" value={v} disabled={!canEdit} onChange={(e) => setV(e.target.value)} className="h-11" />
          <p className="text-xs text-muted-foreground">{t("inv.thresholdHelp")}</p>
        </div>
        {canEdit && <Button type="submit" className="h-11" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</Button>}
      </form>
    </section>
  );
}
