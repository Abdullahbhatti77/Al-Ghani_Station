import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Play, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { FormDialog, matches, useStationCtx } from "@/components/setup/shared";
import { useT } from "@/lib/i18n";
import { formatNumber, formatPKR } from "@/lib/setup";
import { peopleQuery, shiftErrorKey, shiftsQuery, todayKarachi, parseNum } from "@/lib/shifts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/shifts")({
  head: () => ({
    meta: [
      { title: "Shifts — PumpHisab" },
      { name: "description", content: "Start shifts, enter nozzle meter readings and close shifts with cash reconciliation." },
      { property: "og:title", content: "Shifts — PumpHisab" },
      { property: "og:description", content: "Start shifts, enter nozzle meter readings and close shifts with cash reconciliation." },
    ],
  }),
  component: ShiftsPage,
});

export function ShiftStatusBadge({ status }: { status: string }) {
  const t = useT();
  return status === "closed" ? (
    <Badge variant="secondary">{t("shift.status.closed")}</Badge>
  ) : (
    <Badge className="bg-warning text-warning-foreground">{t("shift.status.draft")}</Badge>
  );
}

function ShiftsPage() {
  const t = useT();
  const { stationId } = useStationCtx();
  const [date, setDate] = useState(todayKarachi());
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const [starting, setStarting] = useState(false);
  const { data: shifts = [] } = useQuery(shiftsQuery(stationId, all ? null : date));
  const { data: people = [] } = useQuery(peopleQuery(stationId));
  const { data: openShifts = [] } = useQuery({
    queryKey: ["shifts-open", stationId],
    queryFn: async () => (await supabase.from("shifts").select("id").eq("station_id", stationId).eq("status", "draft")).data ?? [],
  });
  const person = (id: string) => people.find((p) => p.user_id === id)?.full_name ?? "—";
  const rows = shifts.filter((s) => matches(q, s.name, person(s.attendant_id)));
  const openId = openShifts[0]?.id;

  return (
    <>
      <PageHeader
        title={t("shift.title")}
        description={t("shift.desc")}
        actions={
          <Button size="lg" className="h-12 text-base" onClick={() => setStarting(true)} disabled={!!openId}>
            <Play className="h-5 w-5" aria-hidden />
            {t("shift.start")}
          </Button>
        }
      />
      {openId && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-warning/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">{t("shift.openExistsBanner")}</p>
          <Button asChild variant="outline" className="h-11"><Link to="/shifts/$shiftId" params={{ shiftId: openId }}>{t("shift.continue")}</Link></Button>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("shift.search")} aria-label={t("shift.search")} className="h-11 pl-9" />
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={all} aria-label={t("shift.date")} className="h-11 sm:w-44" />
        <label className="flex items-center gap-2 text-sm"><Switch checked={all} onCheckedChange={setAll} />{t("shift.allDates")}</label>
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t("shift.empty")} body={t("shift.emptyBody")} />}
        columns={[
          { key: "d", header: t("shift.date"), cell: (r) => r.shift_date },
          { key: "n", header: t("shift.name"), cell: (r) => <span className="font-medium">{r.name}</span> },
          { key: "a", header: t("shift.attendant"), cell: (r) => person(r.attendant_id) },
          { key: "l", header: t("shift.totalLitres"), cell: (r) => (r.total_litres === null ? "—" : formatNumber(Number(r.total_litres), 2)) },
          { key: "s", header: t("shift.totalSales"), cell: (r) => (r.total_sales === null ? "—" : formatPKR(Number(r.total_sales))) },
          { key: "st", header: t("shift.status"), cell: (r) => <ShiftStatusBadge status={r.status} /> },
          {
            key: "x", header: "", className: "text-right",
            cell: (r) => <Button asChild variant="outline" size="sm"><Link to="/shifts/$shiftId" params={{ shiftId: r.id }}>{t(r.status === "closed" ? "shift.view" : "shift.continue")}</Link></Button>,
          },
        ]}
      />
      {starting && <StartShiftDialog onClose={() => setStarting(false)} />}
    </>
  );
}

export function StartShiftDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { stationId } = useStationCtx();
  const { data: people } = useSuspenseQuery(peopleQuery(stationId));
  const [date, setDate] = useState(todayKarachi());
  const [name, setName] = useState(t("shift.name.morning"));
  const [attendant, setAttendant] = useState("");
  const [float, setFloat] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f = parseNum(float);
    if (!name.trim()) return setErr(t("validation.required"));
    if (!attendant) return setErr(t("validation.selectOne"));
    if (f === null || Number.isNaN(f) || f < 0) return setErr(t("validation.nonNegative"));
    setBusy(true);
    const { data, error } = await supabase.rpc("start_shift", { _station_id: stationId, _date: date, _name: name.trim(), _attendant: attendant, _float: f });
    setBusy(false);
    if (error) return void toast.error(t(shiftErrorKey(error)));
    toast.success(t("shift.started"));
    qc.invalidateQueries({ queryKey: ["shifts"] });
    qc.invalidateQueries({ queryKey: ["shifts-open"] });
    onClose();
    navigate({ to: "/shifts/$shiftId", params: { shiftId: data as string }, search: { step: "start" } });
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("shift.start")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="s-date">{t("shift.date")}</Label>
          <Input id="s-date" type="date" value={date} max={todayKarachi()} onChange={(e) => setDate(e.target.value)} className="h-12 text-lg" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-name">{t("shift.name")}</Label>
          <div className="flex flex-wrap gap-2">
            {(["shift.name.morning", "shift.name.evening", "shift.name.night"] as const).map((k) => (
              <Button key={k} type="button" variant={name === t(k) ? "default" : "outline"} className="h-10" onClick={() => setName(t(k))}>{t(k)}</Button>
            ))}
          </div>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-lg" maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-att">{t("shift.attendant")}</Label>
          <Select value={attendant} onValueChange={setAttendant}>
            <SelectTrigger id="s-att" className="h-12 text-lg"><SelectValue placeholder={t("validation.selectOne")} /></SelectTrigger>
            <SelectContent>{people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-float">{t("shift.float")}</Label>
          <Input id="s-float" inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value)} className="h-12 text-lg tabular-nums" />
          <p className="text-xs text-muted-foreground">{t("shift.floatHelp")}</p>
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" className="h-11" disabled={busy}>{busy ? t("common.saving") : t("shift.start")}</Button>
        </div>
      </form>
    </FormDialog>
  );
}
