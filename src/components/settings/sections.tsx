import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { LanguageSelect } from "@/components/common/language-select";
import { useStationCtx } from "@/components/setup/shared";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery } from "@/lib/finance";
import { productsQuery, tanksQuery, formatNumber } from "@/lib/setup";
import { emailSchema, passwordSchema } from "@/lib/schemas";
import type { StationRole } from "@/lib/station";

export function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LanguageSection() {
  const { t } = useI18n();
  return (
    <Section title={t("lang.title")} desc={t("lang.desc")}>
      <LanguageSelect className="h-11 w-full sm:w-64" />
    </Section>
  );
}

export function LowStockSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { stationId, canEdit } = useStationCtx();
  const { data: tanks } = useSuspenseQuery(tanksQuery(stationId));
  const { data: products } = useSuspenseQuery(productsQuery(stationId));
  const active = tanks.filter((x) => x.is_active);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(active.map((x) => [x.id, String(x.low_stock_litres)])));
  const [busy, setBusy] = useState<string | null>(null);
  async function save(id: string, cap: number) {
    const n = Number(vals[id]);
    if (!Number.isFinite(n) || n < 0) return void toast.error(t("validation.nonNegative"));
    if (n > cap) return void toast.error(t("validation.lowOverCapacity"));
    setBusy(id);
    const { error } = await supabase.from("tanks").update({ low_stock_litres: n }).eq("id", id);
    setBusy(null);
    if (error) return void toast.error(t("auth.genericError"));
    qc.invalidateQueries({ queryKey: ["tanks", stationId] });
    toast.success(t("settings.saved"));
  }
  if (!active.length) return <p className="text-sm text-muted-foreground">{t("common.noData")}</p>;
  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-muted-foreground">{t("thr.lowDesc")}</p>
      {active.map((x) => (
        <div key={x.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`low-${x.id}`}>{x.name} · {products.find((p) => p.id === x.product_id)?.name} ({formatNumber(Number(x.capacity_litres))} L)</Label>
            <Input id={`low-${x.id}`} inputMode="decimal" className="h-11" disabled={!canEdit} value={vals[x.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [x.id]: e.target.value }))} />
          </div>
          {canEdit && <Button className="h-11" variant="outline" disabled={busy === x.id} onClick={() => save(x.id, Number(x.capacity_litres))}>{busy === x.id ? t("common.saving") : t("thr.save")}</Button>}
        </div>
      ))}
    </div>
  );
}

export function CategoriesSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { stationId, canEdit } = useStationCtx();
  const q = useQuery(categoriesQuery(stationId));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["expense_categories", stationId] });
  const errKey = (m?: string): TranslationKey => (m?.includes("uq") || m?.includes("duplicate") ? "setup.err.duplicate" : "auth.genericError");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return void toast.error(t("validation.min2"));
    setBusy(true);
    const { error } = await supabase.from("expense_categories").insert({ station_id: stationId, name: n });
    setBusy(false);
    if (error) return void toast.error(t(errKey(error.message)));
    setName("");
    refresh();
    toast.success(t("cat.saved"));
  }
  async function update(id: string, patch: { name?: string; is_active?: boolean }) {
    if (patch.name !== undefined && patch.name.trim().length < 2) return void toast.error(t("validation.min2"));
    const { error } = await supabase.from("expense_categories").update(patch).eq("id", id);
    if (error) return void toast.error(t(errKey(error.message)));
    setEdit((s) => { const c = { ...s }; delete c[id]; return c; });
    refresh();
    toast.success(t("cat.saved"));
  }

  return (
    <Section title={t("cat.title")} desc={t("cat.desc")}>
      {canEdit && (
        <form onSubmit={add} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="cat-new">{t("cat.name")}</Label>
            <Input id="cat-new" className="h-11" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" className="h-11" disabled={busy}>{busy ? t("common.saving") : t("cat.add")}</Button>
        </form>
      )}
      {q.isPending ? <LoadingState /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data.length === 0 ? <EmptyState title={t("common.noData")} /> : (
        <ul className="divide-y">
          {[...q.data].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)).map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
              {edit[c.id] !== undefined ? (
                <Input aria-label={t("cat.name")} className="h-10 flex-1" value={edit[c.id]} maxLength={60} onChange={(e) => setEdit((s) => ({ ...s, [c.id]: e.target.value }))} />
              ) : (
                <span className="flex-1">{c.name} {!c.is_active && <Badge variant="secondary">{t("cat.archived")}</Badge>}</span>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  {edit[c.id] !== undefined ? (
                    <>
                      <Button size="sm" className="h-10" onClick={() => update(c.id, { name: edit[c.id]!.trim() })}>{t("common.save")}</Button>
                      <Button size="sm" variant="outline" className="h-10" onClick={() => setEdit((s) => { const x = { ...s }; delete x[c.id]; return x; })}>{t("common.cancel")}</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="h-10" onClick={() => setEdit((s) => ({ ...s, [c.id]: c.name }))}>{t("setup.edit")}</Button>
                      <Button size="sm" variant="ghost" className="h-10" onClick={() => update(c.id, { is_active: !c.is_active })}>{c.is_active ? t("cat.archive") : t("cat.restore")}</Button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const ROLES: StationRole[] = ["owner", "manager", "staff"];
const staffErr = (m?: string): TranslationKey =>
  m?.includes("user_not_found") ? "staff.notFound" : m?.includes("already_member") ? "staff.already" : m?.includes("last_owner") ? "staff.lastOwner" : m?.includes("forbidden") ? "shift.err.forbidden" : "auth.genericError";

export function StaffSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { stationId, can, userId } = useStationCtx();
  const manage = can("staff.manage");
  const q = useQuery({
    queryKey: ["station-staff", stationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("station_staff", { _station_id: stationId });
      if (error) throw error;
      return data;
    },
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StationRole>("staff");
  const [busy, setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["station-staff", stationId] }); qc.invalidateQueries({ queryKey: ["station-people", stationId] }); };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const p = emailSchema.safeParse(email);
    if (!p.success) return void toast.error(t("validation.email"));
    setBusy(true);
    const { error } = await supabase.rpc("add_station_member", { _station_id: stationId, _email: p.data, _role: role });
    setBusy(false);
    if (error) return void toast.error(t(staffErr(error.message)));
    setEmail("");
    refresh();
    toast.success(t("staff.added"));
  }
  async function changeRole(id: string, r: StationRole) {
    const { error } = await supabase.rpc("set_member_role", { _member_id: id, _role: r });
    if (error) return void toast.error(t(staffErr(error.message)));
    refresh();
    toast.success(t("staff.changed"));
  }
  async function remove(id: string) {
    const { error } = await supabase.rpc("remove_station_member", { _member_id: id });
    if (error) return void toast.error(t(staffErr(error.message)));
    refresh();
    toast.success(t("staff.removed"));
  }

  return (
    <Section title={t("staff.title")} desc={manage ? t("staff.desc") : t("settings.ownerOnly")}>
      <p className="mb-4 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{t("staff.roleHelp")}</p>
      {manage && (
        <form onSubmit={add} className="mb-5 grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="st-email">{t("staff.email")}</Label>
            <Input id="st-email" type="email" autoComplete="off" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-role">{t("staff.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as StationRole)}>
              <SelectTrigger id="st-role" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" className="h-11" disabled={busy}>{busy ? t("common.saving") : t("staff.add")}</Button>
        </form>
      )}
      {q.isPending ? <LoadingState /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <ul className="divide-y">
          {q.data.map((m) => (
            <li key={m.member_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.full_name || "—"} {m.user_id === userId && <Badge variant="secondary">{t("settings.you")}</Badge>}</p>
                <p className="truncate text-sm text-muted-foreground">{m.email}</p>
              </div>
              {manage && m.user_id !== userId ? (
                <div className="flex gap-2">
                  <Select value={m.role} onValueChange={(v) => changeRole(m.member_id, v as StationRole)}>
                    <SelectTrigger className="h-10 w-40" aria-label={t("staff.role")}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}</SelectContent>
                  </Select>
                  <ConfirmDialog
                    trigger={<Button variant="outline" className="h-10">{t("staff.remove")}</Button>}
                    title={t("staff.removeTitle")}
                    body={t("staff.removeBody")}
                    confirmLabel={t("staff.remove")}
                    onConfirm={() => remove(m.member_id)}
                  />
                </div>
              ) : (
                <Badge variant="secondary">{t(`role.${m.role}`)}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function AccountSection({ email }: { email: string }) {
  const { t } = useI18n();
  const { userId } = useStationCtx();
  const qc = useQueryClient();
  const prof = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle()).data,
  });
  const [name, setName] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<"n" | "p" | null>(null);
  const shownName = name ?? prof.data?.full_name ?? "";

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (shownName.trim().length < 2) return void toast.error(t("validation.min2"));
    setBusy("n");
    const { error } = await supabase.from("profiles").update({ full_name: shownName.trim() }).eq("id", userId);
    setBusy(null);
    if (error) return void toast.error(t("auth.genericError"));
    qc.invalidateQueries({ queryKey: ["profile", userId] });
    qc.invalidateQueries({ queryKey: ["station-people"] });
    toast.success(t("settings.saved"));
  }
  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordSchema.safeParse(pw).success) return void toast.error(t("validation.passwordMin"));
    setBusy("p");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(null);
    if (error) return void toast.error(t("auth.genericError"));
    setPw("");
    toast.success(t("acct.passwordChanged"));
  }

  return (
    <Section title={t("acct.title")}>
      <p className="mb-4 text-sm"><span className="text-muted-foreground">{t("acct.email")}:</span> {email}</p>
      <div className="grid gap-6 sm:grid-cols-2">
        <form onSubmit={saveName} className="space-y-2" noValidate>
          <Label htmlFor="acct-name">{t("acct.name")}</Label>
          <Input id="acct-name" className="h-11" maxLength={80} value={shownName} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" className="h-11" variant="outline" disabled={busy === "n"}>{busy === "n" ? t("common.saving") : t("acct.saveName")}</Button>
        </form>
        <form onSubmit={savePw} className="space-y-2" noValidate>
          <Label htmlFor="acct-pw">{t("acct.newPassword")}</Label>
          <Input id="acct-pw" type="password" autoComplete="new-password" className="h-11" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button type="submit" className="h-11" variant="outline" disabled={busy === "p"}>{busy === "p" ? t("common.saving") : t("acct.changePassword")}</Button>
        </form>
      </div>
    </Section>
  );
}
