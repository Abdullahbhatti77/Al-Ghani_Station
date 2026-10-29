import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog, useStationCtx } from "@/components/setup/shared";
import { useT } from "@/lib/i18n";
import { formatNumber, formatPKR, productsQuery, suppliersQuery, tanksQuery } from "@/lib/setup";
import { parseNum } from "@/lib/shifts";
import {
  adjustmentsQuery, breakdown, compareDip, deliveriesQuery, deliveryAmount, dipsQuery, INVENTORY_KEYS, inventoryErrorKey, invoiceMismatch, movementsQuery, nowLocalInput,
} from "@/lib/inventory";
import { supabase } from "@/integrations/supabase/client";

export function useInventory(stationId: string) {
  const [tanks, products, suppliers, movements, dips, deliveries, adjustments] = useSuspenseQueries({
    queries: [tanksQuery(stationId), productsQuery(stationId), suppliersQuery(stationId), movementsQuery(stationId), dipsQuery(stationId), deliveriesQuery(stationId), adjustmentsQuery(stationId)],
  });
  return { tanks: tanks.data, products: products.data, suppliers: suppliers.data, movements: movements.data, dips: dips.data, deliveries: deliveries.data, adjustments: adjustments.data };
}

export function useInventoryRefresh() {
  const qc = useQueryClient();
  return () => INVENTORY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function Field({ id, label, children, help }: { id: string; label: string; children: ReactNode; help?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function Pick({ id, value, onChange, options, disabled }: { id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  const t = useT();
  return (
    <Select value={value} onValueChange={onChange} disabled={!!disabled}>
      <SelectTrigger id={id} className="h-12 text-base"><SelectValue placeholder={t("validation.selectOne")} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Buttons({ busy, onCancel, label }: { busy: boolean; onCancel: () => void; label?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" className="h-11" onClick={onCancel}>{t("common.cancel")}</Button>
      <Button type="submit" className="h-11" disabled={busy}>{busy ? t("common.saving") : (label ?? t("common.save"))}</Button>
    </div>
  );
}

const toIso = (local: string) => new Date(local).toISOString();
const bad = (n: number | null, allowZero = false) => n === null || Number.isNaN(n) || n < 0 || (!allowZero && n === 0);

export function ReceiveFuelDialog({ onClose, defaultTank }: { onClose: () => void; defaultTank?: string }) {
  const t = useT();
  const refresh = useInventoryRefresh();
  const { stationId } = useStationCtx();
  const d = useInventory(stationId);
  const tank0 = d.tanks.find((x) => x.id === defaultTank);
  const [supplier, setSupplier] = useState("");
  const [product, setProduct] = useState(tank0?.product_id ?? "");
  const [tank, setTank] = useState(tank0?.id ?? "");
  const [at, setAt] = useState(nowLocalInput());
  const [challan, setChallan] = useState("");
  const [litres, setLitres] = useState("");
  const [rate, setRate] = useState("");
  const [invoice, setInvoice] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tanksForProduct = d.tanks.filter((x) => x.is_active && x.product_id === product);
  const sel = d.tanks.find((x) => x.id === tank);
  const space = sel ? Number(sel.capacity_litres) - breakdown(d.movements.filter((m) => m.tank_id === sel.id)).expected : null;
  const l = parseNum(litres), r = parseNum(rate), inv = parseNum(invoice);
  const calc = !bad(l) && !bad(r) ? deliveryAmount(l!, r!) : null;
  const mismatch = calc !== null && !bad(inv, true) && invoiceMismatch(l!, r!, inv!);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supplier || !product || !tank) return setErr(t("validation.selectOne"));
    if (!challan.trim()) return setErr(t("validation.required"));
    if (bad(l) || bad(r) || bad(inv, true)) return setErr(t("validation.positive"));
    if (space !== null && l! > space) return setErr(t("inv.err.overCapacity"));
    if (new Date(at) > new Date()) return setErr(t("inv.err.futureDate"));
    if (!confirmed) return setErr(t("inv.err.confirm"));
    setBusy(true);
    const { error } = await supabase.rpc("record_delivery", {
      _station_id: stationId, _supplier_id: supplier, _tank_id: tank, _delivered_at: toIso(at), _challan: challan, _litres: l!, _rate: r!, _invoice: inv!, _notes: notes,
    });
    setBusy(false);
    if (error) return setErr(t(inventoryErrorKey(error)));
    toast.success(t("inv.saved"));
    refresh();
    onClose();
  }

  const activeSuppliers = d.suppliers.filter((s) => s.is_active);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("inv.receive")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {activeSuppliers.length === 0 && <p className="rounded-lg bg-warning/20 p-3 text-sm">{t("inv.f.noSuppliers")}</p>}
        <Field id="d-sup" label={t("inv.f.supplier")}><Pick id="d-sup" value={supplier} onChange={setSupplier} options={activeSuppliers.map((s) => ({ value: s.id, label: s.business_name }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="d-prod" label={t("inv.f.product")}><Pick id="d-prod" value={product} onChange={(v) => { setProduct(v); setTank(""); }} options={d.products.filter((p) => p.is_fuel && p.is_active).map((p) => ({ value: p.id, label: p.name }))} /></Field>
          <Field id="d-tank" label={t("inv.f.tank")} {...(space !== null ? { help: t("inv.f.space", { v: formatNumber(space, 2) }) } : {})}>
            <Pick id="d-tank" value={tank} onChange={setTank} disabled={!product} options={tanksForProduct.map((x) => ({ value: x.id, label: x.name }))} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="d-at" label={t("inv.f.deliveredAt")}><Input id="d-at" type="datetime-local" value={at} max={nowLocalInput()} onChange={(e) => setAt(e.target.value)} className="h-12" /></Field>
          <Field id="d-ch" label={t("inv.f.challan")}><Input id="d-ch" value={challan} onChange={(e) => setChallan(e.target.value)} maxLength={60} className="h-12" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="d-l" label={t("inv.f.litres")}><Input id="d-l" inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} className="h-12 text-lg tabular-nums" /></Field>
          <Field id="d-r" label={t("inv.f.rate")}><Input id="d-r" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="h-12 text-lg tabular-nums" /></Field>
          <Field id="d-i" label={t("inv.f.invoice")}><Input id="d-i" inputMode="decimal" value={invoice} onChange={(e) => setInvoice(e.target.value)} className="h-12 text-lg tabular-nums" /></Field>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm text-muted-foreground">{t("inv.f.calculated")}</p>
          <p className="font-display text-2xl font-bold tabular-nums">{calc === null ? "—" : formatPKR(calc)}</p>
          {calc !== null && !bad(inv, true) && (
            <p className={mismatch ? "text-sm font-medium text-destructive" : "text-sm text-success"}>
              {mismatch ? t("inv.f.mismatch", { v: formatPKR(Math.abs(calc - inv!)) }) : t("inv.f.match")}
            </p>
          )}
        </div>
        <Field id="d-n" label={t("inv.f.notes")}><Textarea id="d-n" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} aria-label={t("inv.f.confirmInvoice")} />{t("inv.f.confirmInvoice")}</label>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Buttons busy={busy} onCancel={onClose} label={t("inv.receive")} />
      </form>
    </FormDialog>
  );
}

export function DipDialog({ onClose, defaultTank }: { onClose: () => void; defaultTank?: string }) {
  const t = useT();
  const refresh = useInventoryRefresh();
  const { stationId } = useStationCtx();
  const d = useInventory(stationId);
  const [tank, setTank] = useState(defaultTank ?? "");
  const [at, setAt] = useState(nowLocalInput());
  const [litres, setLitres] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const l = parseNum(litres);
    if (!tank) return setErr(t("validation.selectOne"));
    if (bad(l, true)) return setErr(t("validation.nonNegative"));
    if (new Date(at) > new Date()) return setErr(t("inv.err.futureDate"));
    setBusy(true);
    const { error } = await supabase.rpc("record_tank_dip", { _tank_id: tank, _measured_at: toIso(at), _litres: l!, _notes: notes });
    setBusy(false);
    if (error) return setErr(t(inventoryErrorKey(error)));
    toast.success(t("inv.saved"));
    refresh();
    onClose();
  }
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("inv.dip")} description={t("inv.f.dipNote")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="p-tank" label={t("inv.col.tank")}><Pick id="p-tank" value={tank} onChange={setTank} options={d.tanks.filter((x) => x.is_active).map((x) => ({ value: x.id, label: x.name }))} /></Field>
        <Field id="p-at" label={t("inv.f.measuredAt")}><Input id="p-at" type="datetime-local" value={at} max={nowLocalInput()} onChange={(e) => setAt(e.target.value)} className="h-12" /></Field>
        <Field id="p-l" label={t("inv.f.measured")} help={t("inv.f.measuredHelp")}><Input id="p-l" inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} className="h-14 text-2xl tabular-nums" /></Field>
        <Field id="p-n" label={t("inv.f.notes")}><Textarea id="p-n" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Buttons busy={busy} onCancel={onClose} label={t("inv.dip")} />
      </form>
    </FormDialog>
  );
}

export function AdjustDialog({ onClose, defaultTank }: { onClose: () => void; defaultTank?: string }) {
  const t = useT();
  const refresh = useInventoryRefresh();
  const { stationId } = useStationCtx();
  const d = useInventory(stationId);
  const [tank, setTank] = useState(defaultTank ?? "");
  const [litres, setLitres] = useState("");
  const [reason, setReason] = useState("");
  const [dipId, setDipId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cmp = tank ? compareDip(d.movements.filter((m) => m.tank_id === tank), d.dips.filter((x) => x.tank_id === tank)) : null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const l = parseNum(litres);
    if (!tank) return setErr(t("validation.selectOne"));
    if (l === null || Number.isNaN(l) || l === 0) return setErr(t("inv.err.nonZero"));
    if (reason.trim().length < 3) return setErr(t("validation.reasonMin"));
    setBusy(true);
    const { error } = await supabase.rpc("request_stock_adjustment", { _tank_id: tank, _litres: l, _reason: reason, _dip_id: dipId as string });
    setBusy(false);
    if (error) return setErr(t(inventoryErrorKey(error)));
    toast.success(t("inv.saved"));
    refresh();
    onClose();
  }
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("inv.adjust")} description={t("inv.f.adjNote")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="a-tank" label={t("inv.col.tank")}><Pick id="a-tank" value={tank} onChange={(v) => { setTank(v); setDipId(null); }} options={d.tanks.filter((x) => x.is_active).map((x) => ({ value: x.id, label: x.name }))} /></Field>
        {cmp && cmp.status !== "equal" && (
          <Button type="button" variant="outline" className="h-11" onClick={() => { setLitres(String(cmp.difference)); setDipId(cmp.dip.id); }}>
            {t("inv.f.matchDip", { v: formatNumber(Number(cmp.dip.measured_litres), 2) })}
          </Button>
        )}
        <Field id="a-l" label={t("inv.f.adjLitres")} help={t("inv.f.adjHelp")}><Input id="a-l" inputMode="decimal" value={litres} onChange={(e) => { setLitres(e.target.value); setDipId(null); }} className="h-12 text-lg tabular-nums" /></Field>
        <Field id="a-r" label={t("inv.f.reason")}><Textarea id="a-r" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Buttons busy={busy} onCancel={onClose} />
      </form>
    </FormDialog>
  );
}

export function ReasonPrompt({ title, body, onSubmit, onClose, confirmLabel, optional }: { title: string; body?: string; onSubmit: (reason: string) => Promise<string | null>; onClose: () => void; confirmLabel: string; optional?: boolean }) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!optional && reason.trim().length < 3) return setErr(t("validation.reasonMin"));
    setBusy(true);
    const r = await onSubmit(reason);
    setBusy(false);
    if (r) setErr(r); else onClose();
  }
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={title} {...(body ? { description: body } : {})}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="rp-r" label={t(optional ? "inv.f.reviewNote" : "inv.f.reason")}><Textarea id="rp-r" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Buttons busy={busy} onCancel={onClose} label={confirmLabel} />
      </form>
    </FormDialog>
  );
}
