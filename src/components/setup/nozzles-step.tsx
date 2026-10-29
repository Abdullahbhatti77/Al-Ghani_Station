import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { FormField } from "@/components/common/form-field";
import { useT } from "@/lib/i18n";
import { dbErrorKey, formatNumber, nozzleSchema, nozzlesQuery, productsQuery, tanksQuery, type Nozzle, type Product, type Tank } from "@/lib/setup";
import { supabase } from "@/integrations/supabase/client";
import { ActiveBadge, FormButtons, FormDialog, Help, ListToolbar, matches, RowActions, SelectField, StepIntro, useStationCtx } from "./shared";

type In = z.input<typeof nozzleSchema>;
type Out = z.output<typeof nozzleSchema>;

export function NozzlesStep() {
  const t = useT();
  const qc = useQueryClient();
  const { stationId, canEdit } = useStationCtx();
  const { data: nozzles } = useSuspenseQuery(nozzlesQuery(stationId));
  const { data: tanks } = useSuspenseQuery(tanksQuery(stationId));
  const { data: products } = useSuspenseQuery(productsQuery(stationId));
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Nozzle | "new" | null>(null);

  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const tName = (id: string) => tanks.find((x) => x.id === id)?.name ?? "—";
  const rows = nozzles.filter((n) => (showArchived || n.is_active) && matches(q, n.number, n.display_name, pName(n.product_id), tName(n.tank_id)));
  const activeTanks = tanks.filter((x) => x.is_active);
  const refresh = () => qc.invalidateQueries({ queryKey: ["nozzles", stationId] });

  async function toggle(n: Nozzle) {
    const { error } = await supabase.from("nozzles").update({ is_active: !n.is_active }).eq("id", n.id);
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t(n.is_active ? "setup.archivedToast" : "setup.restoredToast"));
    refresh();
  }

  return (
    <>
      <StepIntro help="nozzle.help" example="nozzle.exampleText" />
      {activeTanks.length === 0 && <p className="mb-4 rounded-lg bg-warning/20 p-3 text-sm">{t("setup.needTanks")}</p>}
      <ListToolbar search={q} onSearch={setQ} showArchived={showArchived} onShowArchived={setShowArchived} onAdd={() => setEditing("new")} addLabel={t("nozzle.addTitle")} canEdit={canEdit} addDisabled={activeTanks.length === 0} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={nozzles.length ? t("setup.noMatch") : t("nozzle.empty")} />}
        columns={[
          { key: "no", header: t("nozzle.number"), cell: (r) => <span className="font-display text-lg font-bold">{r.number}</span> },
          { key: "n", header: t("nozzle.name"), cell: (r) => <span className="font-medium">{r.display_name}</span> },
          { key: "p", header: t("nozzle.product"), cell: (r) => pName(r.product_id) },
          { key: "t", header: t("nozzle.tank"), cell: (r) => tName(r.tank_id) },
          { key: "m", header: t("nozzle.meter"), cell: (r) => <span className="tabular-nums">{formatNumber(Number(r.meter_reading), 2)}</span> },
          { key: "st", header: t("setup.status"), cell: (r) => <ActiveBadge active={r.is_active} /> },
          { key: "a", header: "", className: "text-right", cell: (r) => <RowActions active={r.is_active} canEdit={canEdit} onEdit={() => setEditing(r)} onToggle={() => toggle(r)} /> },
        ]}
      />
      {editing && (
        <NozzleForm
          nozzle={editing === "new" ? null : editing}
          stationId={stationId}
          products={products.filter((p) => p.is_fuel && p.is_active)}
          tanks={activeTanks}
          nextNumber={Math.max(0, ...nozzles.map((n) => n.number)) + 1}
          onDone={() => { setEditing(null); refresh(); }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}

function NozzleForm({ nozzle, stationId, products, tanks, nextNumber, onDone, onCancel }: { nozzle: Nozzle | null; stationId: string; products: Product[]; tanks: Tank[]; nextNumber: number; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(nozzleSchema),
    defaultValues: nozzle
      ? { number: nozzle.number, display_name: nozzle.display_name, product_id: nozzle.product_id, tank_id: nozzle.tank_id, meter_reading: Number(nozzle.meter_reading) }
      : { number: nextNumber, display_name: "", product_id: "", tank_id: "", meter_reading: 0 },
  });
  const e = form.formState.errors;
  const productId = useWatch({ control: form.control, name: "product_id" });
  const compatible = tanks.filter((x) => x.product_id === productId);

  const onSubmit = form.handleSubmit(async (v) => {
    if (!compatible.some((x) => x.id === v.tank_id)) {
      form.setError("tank_id", { message: "setup.err.mismatch" });
      return;
    }
    const { error } = nozzle
      ? await supabase.from("nozzles").update(v).eq("id", nozzle.id)
      : await supabase.from("nozzles").insert({ ...v, station_id: stationId });
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t("setup.saved"));
    onDone();
  });

  return (
    <FormDialog open onOpenChange={(o) => !o && onCancel()} title={t(nozzle ? "nozzle.editTitle" : "nozzle.addTitle")} description={t("nozzle.help")}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="n-no" type="number" inputMode="numeric" label={t("nozzle.number")} registration={form.register("number")} error={e.number} />
        <div className="space-y-1.5">
          <FormField id="n-name" label={t("nozzle.name")} registration={form.register("display_name")} error={e.display_name} placeholder="Petrol Front Left" />
          <Help k="nozzle.nameHelp" />
        </div>
        <SelectField
          control={form.control}
          name="product_id"
          id="n-product"
          label={t("nozzle.product")}
          error={e.product_id}
          options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
          onChangeExtra={() => form.setValue("tank_id", "")}
        />
        <div className="space-y-1.5">
          <SelectField
            control={form.control}
            name="tank_id"
            id="n-tank"
            label={t("nozzle.tank")}
            error={e.tank_id}
            disabled={!productId || compatible.length === 0}
            options={compatible.map((x) => ({ value: x.id, label: x.name }))}
          />
          {productId && compatible.length === 0 ? <p className="text-sm text-warning-foreground">{t("nozzle.noTanksForProduct")}</p> : <Help k="nozzle.tankHelp" />}
        </div>
        <div className="space-y-1.5">
          <FormField id="n-meter" type="number" inputMode="decimal" step="any" label={t("nozzle.meter")} registration={form.register("meter_reading")} error={e.meter_reading} />
          <Help k="nozzle.meterHelp" />
        </div>
        <FormButtons submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </FormDialog>
  );
}
