import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { FormField } from "@/components/common/form-field";
import { useT } from "@/lib/i18n";
import { dbErrorKey, formatNumber, productsQuery, stockCorrectionSchema, tankSchema, tanksQuery, type Tank } from "@/lib/setup";
import { supabase } from "@/integrations/supabase/client";
import { ActiveBadge, FormButtons, FormDialog, Help, ListToolbar, matches, RowActions, SelectField, StepIntro, useStationCtx } from "./shared";

type In = z.input<typeof tankSchema>;
type Out = z.output<typeof tankSchema>;

export function TanksStep() {
  const t = useT();
  const qc = useQueryClient();
  const { stationId, canEdit } = useStationCtx();
  const { data: tanks } = useSuspenseQuery(tanksQuery(stationId));
  const { data: products } = useSuspenseQuery(productsQuery(stationId));
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Tank | "new" | null>(null);
  const [correcting, setCorrecting] = useState<Tank | null>(null);

  const fuels = products.filter((p) => p.is_fuel && p.is_active);
  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const rows = tanks.filter((x) => (showArchived || x.is_active) && matches(q, x.name, pName(x.product_id)));
  const refresh = () => qc.invalidateQueries({ queryKey: ["tanks", stationId] });

  async function toggle(x: Tank) {
    const { error } = await supabase.from("tanks").update({ is_active: !x.is_active }).eq("id", x.id);
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t(x.is_active ? "setup.archivedToast" : "setup.restoredToast"));
    refresh();
  }

  return (
    <>
      <StepIntro help="tank.help" example="tank.exampleText" />
      {fuels.length === 0 && <p className="mb-4 rounded-lg bg-warning/20 p-3 text-sm">{t("setup.needProducts")}</p>}
      <ListToolbar search={q} onSearch={setQ} showArchived={showArchived} onShowArchived={setShowArchived} onAdd={() => setEditing("new")} addLabel={t("tank.addTitle")} canEdit={canEdit} addDisabled={fuels.length === 0} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={tanks.length ? t("setup.noMatch") : t("tank.empty")} />}
        columns={[
          { key: "name", header: t("tank.name"), cell: (r) => <span className="font-medium">{r.name}</span> },
          { key: "p", header: t("tank.product"), cell: (r) => pName(r.product_id) },
          {
            key: "stock",
            header: t("tank.stock"),
            cell: (r) => {
              const stock = Number(r.opening_stock_litres), cap = Number(r.capacity_litres);
              const low = stock <= Number(r.low_stock_litres);
              return (
                <div className="min-w-[160px] space-y-1">
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    <span className="font-semibold">{formatNumber(stock)}</span>
                    <span className="text-muted-foreground">/ {formatNumber(cap)} L</span>
                    {low && <Badge className="bg-warning text-warning-foreground">{t("tank.lowBadge")}</Badge>}
                  </div>
                  <Progress value={(stock / cap) * 100} className="h-1.5" />
                </div>
              );
            },
          },
          { key: "st", header: t("setup.status"), cell: (r) => <ActiveBadge active={r.is_active} /> },
          {
            key: "a",
            header: "",
            className: "text-right",
            cell: (r) => (
              <div className="flex justify-end">
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setCorrecting(r)} aria-label={t("tank.correct")}>
                    <Gauge className="h-4 w-4" aria-hidden />
                    <span className="hidden md:inline">{t("tank.correct")}</span>
                  </Button>
                )}
                <RowActions active={r.is_active} canEdit={canEdit} onEdit={() => setEditing(r)} onToggle={() => toggle(r)} />
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <TankForm
          tank={editing === "new" ? null : editing}
          stationId={stationId}
          fuelOptions={fuels.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
          onDone={() => { setEditing(null); refresh(); }}
          onCancel={() => setEditing(null)}
        />
      )}
      {correcting && <CorrectionForm tank={correcting} onDone={() => { setCorrecting(null); refresh(); }} onCancel={() => setCorrecting(null)} />}
    </>
  );
}

function TankForm({ tank, stationId, fuelOptions, onDone, onCancel }: { tank: Tank | null; stationId: string; fuelOptions: { value: string; label: string }[]; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(tankSchema),
    defaultValues: tank
      ? { name: tank.name, product_id: tank.product_id, capacity_litres: Number(tank.capacity_litres), opening_stock_litres: Number(tank.opening_stock_litres), low_stock_litres: Number(tank.low_stock_litres) }
      : { name: "", product_id: "", capacity_litres: "" as unknown as number, opening_stock_litres: "" as unknown as number, low_stock_litres: 0 },
  });
  const e = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    let error;
    if (tank) {
      // Stock is not editable here; it changes only via the correction workflow.
      ({ error } = await supabase.from("tanks").update({ name: v.name, product_id: v.product_id, capacity_litres: v.capacity_litres, low_stock_litres: v.low_stock_litres }).eq("id", tank.id));
    } else {
      ({ error } = await supabase.from("tanks").insert({ ...v, station_id: stationId }));
    }
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t("setup.saved"));
    onDone();
  });
  return (
    <FormDialog open onOpenChange={(o) => !o && onCancel()} title={t(tank ? "tank.editTitle" : "tank.addTitle")} description={t("tank.help")}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="t-name" label={t("tank.name")} registration={form.register("name")} error={e.name} placeholder="Tank 1" />
        <SelectField control={form.control} name="product_id" id="t-product" label={t("tank.product")} options={fuelOptions} error={e.product_id} />
        <FormField id="t-cap" type="number" inputMode="decimal" step="any" label={t("tank.capacity")} registration={form.register("capacity_litres")} error={e.capacity_litres} placeholder="25000" />
        <div className="space-y-1.5">
          <FormField id="t-open" type="number" inputMode="decimal" step="any" label={t("tank.opening")} registration={form.register("opening_stock_litres")} error={e.opening_stock_litres} placeholder="12400" disabled={!!tank} />
          <Help k={tank ? "tank.stockLocked" : "tank.openingHelp"} />
        </div>
        <div className="space-y-1.5">
          <FormField id="t-low" type="number" inputMode="decimal" step="any" label={t("tank.low")} registration={form.register("low_stock_litres")} error={e.low_stock_litres} placeholder="3000" />
          <Help k="tank.lowHelp" />
        </div>
        <FormButtons submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </FormDialog>
  );
}

function CorrectionForm({ tank, onDone, onCancel }: { tank: Tank; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const schema = stockCorrectionSchema(Number(tank.capacity_litres));
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { new_litres: Number(tank.opening_stock_litres), reason: "" },
  });
  const e = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.rpc("correct_tank_stock", { _tank_id: tank.id, _new_litres: v.new_litres, _reason: v.reason });
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t("setup.saved"));
    onDone();
  });
  return (
    <FormDialog open onOpenChange={(o) => !o && onCancel()} title={`${t("tank.correctTitle")} — ${tank.name}`} description={t("tank.correctBody")}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="c-new" type="number" inputMode="decimal" step="any" label={`${t("tank.newStock")} (max ${formatNumber(Number(tank.capacity_litres))})`} registration={form.register("new_litres")} error={e.new_litres} />
        <FormField id="c-reason" label={t("tank.reason")} placeholder={t("tank.reasonPh")} registration={form.register("reason")} error={e.reason} />
        <FormButtons submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </FormDialog>
  );
}
