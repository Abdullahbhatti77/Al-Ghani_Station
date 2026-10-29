import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { FormField } from "@/components/common/form-field";
import { useT } from "@/lib/i18n";
import { dbErrorKey, formatPKR, supplierSchema, suppliersQuery, type Supplier } from "@/lib/setup";
import { supabase } from "@/integrations/supabase/client";
import { ActiveBadge, FormButtons, FormDialog, Help, ListToolbar, matches, RowActions, StepIntro, useStationCtx } from "./shared";

type In = z.input<typeof supplierSchema>;
type Out = z.output<typeof supplierSchema>;

export function SuppliersStep() {
  const t = useT();
  const qc = useQueryClient();
  const { stationId, canEdit } = useStationCtx();
  const { data: suppliers } = useSuspenseQuery(suppliersQuery(stationId));
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const rows = suppliers.filter((s) => (showArchived || s.is_active) && matches(q, s.business_name, s.contact_person, s.phone));
  const refresh = () => qc.invalidateQueries({ queryKey: ["suppliers", stationId] });

  async function toggle(s: Supplier) {
    const { error } = await supabase.from("suppliers").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t(s.is_active ? "setup.archivedToast" : "setup.restoredToast"));
    refresh();
  }

  return (
    <>
      <StepIntro help="supplier.help" example="supplier.exampleText" />
      <ListToolbar search={q} onSearch={setQ} showArchived={showArchived} onShowArchived={setShowArchived} onAdd={() => setEditing("new")} addLabel={t("supplier.addTitle")} canEdit={canEdit} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={suppliers.length ? t("setup.noMatch") : t("supplier.empty")} />}
        columns={[
          { key: "n", header: t("supplier.name"), cell: (r) => <span className="font-medium">{r.business_name}</span> },
          { key: "c", header: t("supplier.contact"), cell: (r) => r.contact_person ?? "" },
          { key: "p", header: t("supplier.phone"), cell: (r) => r.phone ?? "" },
          { key: "o", header: t("supplier.opening"), cell: (r) => <span className="tabular-nums">{formatPKR(Number(r.opening_payable))}</span> },
          { key: "st", header: t("setup.status"), cell: (r) => <ActiveBadge active={r.is_active} /> },
          { key: "a", header: "", className: "text-right", cell: (r) => <RowActions active={r.is_active} canEdit={canEdit} onEdit={() => setEditing(r)} onToggle={() => toggle(r)} /> },
        ]}
      />
      {editing && <SupplierForm supplier={editing === "new" ? null : editing} stationId={stationId} onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />}
    </>
  );
}

function SupplierForm({ supplier, stationId, onDone, onCancel }: { supplier: Supplier | null; stationId: string; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      business_name: supplier?.business_name ?? "",
      contact_person: supplier?.contact_person ?? "",
      phone: supplier?.phone ?? "",
      address: supplier?.address ?? "",
      opening_payable: supplier ? Number(supplier.opening_payable) : 0,
      notes: supplier?.notes ?? "",
    },
  });
  const e = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      business_name: v.business_name,
      contact_person: v.contact_person || null,
      phone: v.phone || null,
      address: v.address || null,
      opening_payable: v.opening_payable,
      notes: v.notes || null,
    };
    const { error } = supplier
      ? await supabase.from("suppliers").update(payload).eq("id", supplier.id)
      : await supabase.from("suppliers").insert({ ...payload, station_id: stationId });
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t("setup.saved"));
    onDone();
  });
  return (
    <FormDialog open onOpenChange={(o) => !o && onCancel()} title={t(supplier ? "supplier.editTitle" : "supplier.addTitle")} description={t("supplier.help")}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="s-name" label={t("supplier.name")} registration={form.register("business_name")} error={e.business_name} placeholder="PSO Lahore Depot" />
        <FormField id="s-contact" label={t("supplier.contact")} registration={form.register("contact_person")} error={e.contact_person} />
        <FormField id="s-phone" type="tel" inputMode="tel" label={t("supplier.phone")} registration={form.register("phone")} error={e.phone} placeholder="042 1234567" />
        <FormField id="s-address" label={t("supplier.address")} registration={form.register("address")} error={e.address} />
        <div className="space-y-1.5">
          <FormField id="s-open" type="number" inputMode="decimal" step="0.01" label={t("supplier.opening")} registration={form.register("opening_payable")} error={e.opening_payable} />
          <Help k="supplier.openingHelp" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-notes">{t("supplier.notes")}</Label>
          <Textarea id="s-notes" {...form.register("notes")} />
        </div>
        <FormButtons submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </FormDialog>
  );
}
