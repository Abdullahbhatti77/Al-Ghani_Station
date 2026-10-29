import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { FormField } from "@/components/common/form-field";
import { useT } from "@/lib/i18n";
import { dbErrorKey, productSchema, productsQuery, type Product } from "@/lib/setup";
import { supabase } from "@/integrations/supabase/client";
import { ActiveBadge, FormButtons, FormDialog, Help, ListToolbar, matches, RowActions, SelectField, StepIntro, useStationCtx } from "./shared";

type In = z.input<typeof productSchema>;
type Out = z.output<typeof productSchema>;

export function ProductsStep() {
  const t = useT();
  const qc = useQueryClient();
  const { stationId, canEdit } = useStationCtx();
  const { data: products } = useSuspenseQuery(productsQuery(stationId));
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const rows = products.filter((p) => (showArchived || p.is_active) && matches(q, p.name, p.code));
  const refresh = () => qc.invalidateQueries({ queryKey: ["products", stationId] });

  async function toggle(p: Product) {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t(p.is_active ? "setup.archivedToast" : "setup.restoredToast"));
    refresh();
  }

  return (
    <>
      <StepIntro help="product.help" example="product.exampleText" />
      <ListToolbar search={q} onSearch={setQ} showArchived={showArchived} onShowArchived={setShowArchived} onAdd={() => setEditing("new")} addLabel={t("product.addTitle")} canEdit={canEdit} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={products.length ? t("setup.noMatch") : t("product.empty")} />}
        columns={[
          { key: "name", header: t("product.name"), cell: (r) => <span className="font-medium">{r.name}</span> },
          { key: "code", header: t("product.code"), cell: (r) => <Badge variant="outline">{r.code}</Badge> },
          { key: "unit", header: t("product.unit"), cell: (r) => t(`product.unit.${r.unit}` as "product.unit.litre") },
          { key: "type", header: t("product.type"), cell: (r) => t(r.is_fuel ? "product.fuel" : "product.other") },
          { key: "st", header: t("setup.status"), cell: (r) => <ActiveBadge active={r.is_active} /> },
          { key: "a", header: "", className: "text-right", cell: (r) => <RowActions active={r.is_active} canEdit={canEdit} onEdit={() => setEditing(r)} onToggle={() => toggle(r)} /> },
        ]}
      />
      {editing && <ProductForm product={editing === "new" ? null : editing} stationId={stationId} onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />}
    </>
  );
}

function ProductForm({ product, stationId, onDone, onCancel }: { product: Product | null; stationId: string; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? { name: product.name, code: product.code, unit: product.unit as Out["unit"], is_fuel: product.is_fuel }
      : { name: "", code: "", unit: "litre", is_fuel: true },
  });
  const e = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    const payload = { ...v, code: v.code.toUpperCase() };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert({ ...payload, station_id: stationId });
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t("setup.saved"));
    onDone();
  });
  return (
    <FormDialog open onOpenChange={(o) => !o && onCancel()} title={t(product ? "product.editTitle" : "product.addTitle")} description={t("product.help")}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="p-name" label={t("product.name")} registration={form.register("name")} error={e.name} placeholder="Petrol (Super)" />
        <div className="space-y-1.5">
          <FormField id="p-code" label={t("product.code")} registration={form.register("code")} error={e.code} placeholder="MS" />
          <Help k="product.codeHelp" />
        </div>
        <SelectField
          control={form.control}
          name="unit"
          id="p-unit"
          label={t("product.unit")}
          error={e.unit}
          options={(["litre", "kg", "piece"] as const).map((u) => ({ value: u, label: t(`product.unit.${u}`) }))}
        />
        <label className="flex items-center gap-3 text-sm">
          <Controller control={form.control} name="is_fuel" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          {t("product.isFuel")}
        </label>
        <FormButtons submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </FormDialog>
  );
}
