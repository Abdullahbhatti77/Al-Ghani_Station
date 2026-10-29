import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { AlertTriangle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormDialog, useStationCtx } from "@/components/setup/shared";
import { useT, type TranslationKey } from "@/lib/i18n";
import { formatPKR, pricesQuery, productsQuery, suppliersQuery } from "@/lib/setup";
import { parseNum, priceAt } from "@/lib/shifts";
import { nowLocalInput } from "@/lib/inventory";
import {
  categoriesQuery, creditCheck, customerBalance, customersQuery, customerTxnsQuery, EXPENSE_METHODS, FINANCE_KEYS, financeErrorKey,
  newKey, openShiftsQuery, PAYMENT_METHODS, SUPPLIER_METHODS, type Customer,
} from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";

export function useFinanceRefresh() {
  const qc = useQueryClient();
  return () => FINANCE_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useCustomers(stationId: string) {
  const [c, x] = useSuspenseQueries({ queries: [customersQuery(stationId), customerTxnsQuery(stationId)] });
  const balances = useMemo(() => {
    const m = new Map<string, number>();
    for (const cu of c.data) m.set(cu.id, customerBalance(Number(cu.opening_balance), x.data.filter((t) => t.customer_id === cu.id)));
    return m;
  }, [c.data, x.data]);
  return { customers: c.data, txns: x.data, balances };
}

export function Field({ id, label, children, help }: { id: string; label: string; children: ReactNode; help?: string | undefined }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

export function Pick({ id, value, onChange, options, disabled }: { id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  const t = useT();
  return (
    <Select value={value} onValueChange={onChange} disabled={!!disabled}>
      <SelectTrigger id={id} className="h-12 text-base"><SelectValue placeholder={t("validation.selectOne")} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

const big = "h-12 text-lg tabular-nums";
const toIso = (local: string) => new Date(local).toISOString();
const posNum = (s: string) => { const n = parseNum(s); return n === null || Number.isNaN(n) || n <= 0 ? null : n; };

/** Two-stage form: fill in → review summary → confirm. */
function Review({ lines, busy, onBack, onConfirm, warn }: { lines: [string, string][]; busy: boolean; onBack: () => void; onConfirm: () => void; warn?: ReactNode }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("fin.reviewIntro")}</p>
      <dl className="divide-y rounded-xl border">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 p-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>
      {warn}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-12" onClick={onBack}>{t("common.back")}</Button>
        <Button type="button" className="h-12" disabled={busy} onClick={onConfirm}>{busy ? t("common.saving") : t("fin.confirmSave")}</Button>
      </div>
    </div>
  );
}

function FormButtons({ onCancel, label }: { onCancel: () => void; label?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" className="h-12" onClick={onCancel}>{t("common.cancel")}</Button>
      <Button type="submit" className="h-12">{label ?? t("fin.reviewBtn")}</Button>
    </div>
  );
}

function useSubmit(onClose: () => void, okKey: TranslationKey) {
  const t = useT();
  const refresh = useFinanceRefresh();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => PromiseLike<{ error: { message?: string } | null }>) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return void toast.error(t(financeErrorKey(error)));
    toast.success(t(okKey));
    refresh();
    onClose();
  };
  return { busy, run };
}

// ---------------- Customer ----------------
export function CustomerDialog({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const t = useT();
  const { stationId } = useStationCtx();
  const { txns } = useCustomers(stationId);
  const locked = !!customer && txns.some((x) => x.customer_id === customer.id);
  const [v, setV] = useState({
    name: customer?.name ?? "", business_name: customer?.business_name ?? "", phone: customer?.phone ?? "", address: customer?.address ?? "",
    vehicles: (customer?.vehicles ?? []).join(", "), credit_limit: customer?.credit_limit === null || !customer ? "" : String(customer.credit_limit),
    opening_balance: customer ? String(customer.opening_balance) : "0", notes: customer?.notes ?? "",
  });
  const { busy, run } = useSubmit(onClose, "fin.cust.saved");
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (v.name.trim().length < 2) return void toast.error(t("validation.min2"));
    if (v.phone && !/^[0-9+\-\s]{7,16}$/.test(v.phone)) return void toast.error(t("validation.phone"));
    const lim = parseNum(v.credit_limit), open = parseNum(v.opening_balance);
    if ((lim !== null && (Number.isNaN(lim) || lim < 0)) || open === null || Number.isNaN(open)) return void toast.error(t("validation.number"));
    const row = {
      name: v.name.trim(), business_name: v.business_name.trim() || null, phone: v.phone.trim() || null, address: v.address.trim() || null,
      vehicles: v.vehicles.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean), credit_limit: lim, notes: v.notes.trim() || null,
      ...(locked ? {} : { opening_balance: open }),
    };
    void run(() => (customer ? supabase.from("customers").update(row).eq("id", customer.id) : supabase.from("customers").insert({ ...row, station_id: stationId })));
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t(customer ? "fin.cust.editTitle" : "fin.cust.addTitle")} description={t("fin.cust.help")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="c-name" label={t("fin.cust.name")}><Input id="c-name" value={v.name} onChange={set("name")} className={big} maxLength={100} /></Field>
        <Field id="c-biz" label={t("fin.cust.business")}><Input id="c-biz" value={v.business_name} onChange={set("business_name")} className="h-12" maxLength={120} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="c-phone" label={t("fin.cust.phone")}><Input id="c-phone" inputMode="tel" value={v.phone} onChange={set("phone")} className="h-12" placeholder="0300 1234567" /></Field>
          <Field id="c-limit" label={t("fin.cust.limit")} help={t("fin.cust.limitHelp")}><Input id="c-limit" inputMode="decimal" value={v.credit_limit} onChange={set("credit_limit")} className={big} /></Field>
        </div>
        <Field id="c-addr" label={t("fin.cust.address")}><Input id="c-addr" value={v.address} onChange={set("address")} className="h-12" maxLength={200} /></Field>
        <Field id="c-veh" label={t("fin.cust.vehicles")} help={t("fin.cust.vehiclesHelp")}><Input id="c-veh" value={v.vehicles} onChange={set("vehicles")} className="h-12" placeholder="LEA-1234, LHR-5678" /></Field>
        <Field id="c-open" label={t("fin.cust.opening")} help={t(locked ? "fin.err.openingLocked" : "fin.cust.openingHelp")}>
          <Input id="c-open" inputMode="decimal" value={v.opening_balance} onChange={set("opening_balance")} disabled={locked} className={big} />
        </Field>
        <Field id="c-notes" label={t("supplier.notes")}><Textarea id="c-notes" value={v.notes} onChange={set("notes")} maxLength={500} /></Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-12" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" className="h-12" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</Button>
        </div>
      </form>
    </FormDialog>
  );
}

function useShiftOptions(stationId: string) {
  const [s] = useSuspenseQueries({ queries: [openShiftsQuery(stationId)] });
  return s.data;
}

// ---------------- Credit sale ----------------
export function CreditSaleDialog({ customerId, shiftId, onClose }: { customerId?: string; shiftId?: string; onClose: () => void }) {
  const t = useT();
  const { stationId, canEdit } = useStationCtx();
  const { customers, balances } = useCustomers(stationId);
  const shifts = useShiftOptions(stationId);
  const [p, pr] = useSuspenseQueries({ queries: [productsQuery(stationId), pricesQuery(stationId)] });
  const [key] = useState(newKey);
  const [v, setV] = useState({ customer: customerId ?? "", shift: shiftId ?? shifts[0]?.id ?? "", product: "", byAmount: false, qty: "", vehicle: "", reference: "", notes: "", reason: "" });
  const [review, setReview] = useState(false);
  const { busy, run } = useSubmit(onClose, "fin.sale.saved");

  const cust = customers.find((c) => c.id === v.customer);
  const shift = shifts.find((s) => s.id === v.shift);
  const price = shift && v.product ? priceAt(pr.data, v.product, new Date(shift.price_at)) : null;
  const rate = price ? Number(price.price_per_litre) : null;
  const q = posNum(v.qty);
  const amount = q && rate ? (v.byAmount ? Math.round(q * 100) / 100 : Math.round(q * rate * 100) / 100) : null;
  const litres = q && rate ? (v.byAmount ? Math.round((q / rate) * 100) / 100 : q) : null;
  const bal = cust ? balances.get(cust.id) ?? 0 : 0;
  const chk = amount !== null && cust ? creditCheck(bal, amount, cust.credit_limit === null ? null : Number(cust.credit_limit)) : null;

  if (shifts.length === 0) return <NoShift onClose={onClose} title={t("fin.sale.title")} />;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!cust || !shift || !v.product) return void toast.error(t("validation.selectOne"));
    if (!rate) return void toast.error(t("shift.err.noPrice"));
    if (!amount) return void toast.error(t("validation.positive"));
    if (chk?.over && !canEdit) return void toast.error(t("fin.err.overLimitManager"));
    if (chk?.over && v.reason.trim().length < 3) return void toast.error(t("validation.reasonMin"));
    setReview(true);
  }
  const confirm = () =>
    run(() => supabase.rpc("record_credit_sale", {
      _customer_id: v.customer, _shift_id: v.shift, _product_id: v.product,
      _litres: (v.byAmount ? null : litres) as number, _amount: (v.byAmount ? amount : null) as number,
      _vehicle: v.vehicle, _reference: v.reference, _notes: v.notes, _approval_reason: (chk?.over ? v.reason : null) as string, _client_key: key,
    }));

  const vehicles = cust?.vehicles ?? [];
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("fin.sale.title")} description={t("fin.sale.help")}>
      {review ? (
        <Review busy={busy} onBack={() => setReview(false)} onConfirm={() => void confirm()}
          lines={[[t("fin.customer"), cust!.name], [t("fin.shift"), `${shift!.name} · ${shift!.shift_date}`], [t("shift.fuel"), p.data.find((x) => x.id === v.product)?.name ?? ""],
            [t("shift.litres"), `${litres} L`], [t("shift.rate"), formatPKR(rate!)], [t("shift.amount"), formatPKR(amount!)], [t("fin.newBalance"), formatPKR(chk!.newBalance)]]}
          warn={chk?.over ? <OverLimit excess={chk.excess} /> : undefined} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="s-cust" label={t("fin.customer")}><Pick id="s-cust" value={v.customer} onChange={(x) => setV({ ...v, customer: x, vehicle: "" })} options={customers.filter((c) => c.is_active).map((c) => ({ value: c.id, label: `${c.name}${c.business_name ? ` (${c.business_name})` : ""}` }))} /></Field>
          {cust && (
            <p className="rounded-lg bg-secondary p-3 text-sm">
              {t("fin.currentBalance")}: <b className="tabular-nums">{formatPKR(bal)}</b> · {t("fin.cust.limit")}: <b className="tabular-nums">{cust.credit_limit === null ? t("fin.noLimit") : formatPKR(Number(cust.credit_limit))}</b>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="s-shift" label={t("fin.shift")}><Pick id="s-shift" value={v.shift} onChange={(x) => setV({ ...v, shift: x })} options={shifts.map((s) => ({ value: s.id, label: `${s.name} · ${s.shift_date}` }))} /></Field>
            <Field id="s-prod" label={t("shift.fuel")}><Pick id="s-prod" value={v.product} onChange={(x) => setV({ ...v, product: x })} options={p.data.filter((x) => x.is_fuel && x.is_active).map((x) => ({ value: x.id, label: x.name }))} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={v.byAmount} onCheckedChange={(b) => setV({ ...v, byAmount: b, qty: "" })} />{t("fin.sale.byAmount")}</label>
          <Field id="s-qty" label={t(v.byAmount ? "fin.amountPkr" : "fin.sale.litres")} help={rate ? `${t("shift.rate")}: ${formatPKR(rate)}` : v.product ? t("shift.err.noPrice") : undefined}>
            <Input id="s-qty" inputMode="decimal" value={v.qty} onChange={(e) => setV({ ...v, qty: e.target.value })} className="h-14 text-2xl font-semibold tabular-nums" />
          </Field>
          {amount !== null && <p className="font-display text-xl font-bold tabular-nums">{litres} L = {formatPKR(amount)}</p>}
          {chk?.over && (
            <div className="space-y-2">
              <OverLimit excess={chk.excess} />
              {canEdit ? (
                <Field id="s-reason" label={t("fin.sale.approvalReason")}><Textarea id="s-reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} maxLength={300} /></Field>
              ) : <p className="text-sm font-medium text-destructive">{t("fin.err.overLimitManager")}</p>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="s-veh" label={t("fin.vehicle")}>
              {vehicles.length ? <Pick id="s-veh" value={v.vehicle} onChange={(x) => setV({ ...v, vehicle: x })} options={vehicles.map((x) => ({ value: x, label: x }))} />
                : <Input id="s-veh" value={v.vehicle} onChange={(e) => setV({ ...v, vehicle: e.target.value })} className="h-12" />}
            </Field>
            <Field id="s-ref" label={t("fin.reference")}><Input id="s-ref" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className="h-12" placeholder={t("fin.sale.refPh")} /></Field>
          </div>
          <Field id="s-notes" label={t("supplier.notes")}><Textarea id="s-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={300} /></Field>
          <FormButtons onCancel={onClose} />
        </form>
      )}
    </FormDialog>
  );
}

function OverLimit({ excess }: { excess: number }) {
  const t = useT();
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/5 p-3 text-sm font-medium text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{t("fin.sale.overLimit", { v: formatPKR(excess) })}
    </p>
  );
}

function NoShift({ onClose, title }: { onClose: () => void; title: string }) {
  const t = useT();
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={title}>
      <p className="text-sm">{t("fin.needOpenShift")}</p>
      <Button className="h-12" onClick={onClose}>{t("common.back")}</Button>
    </FormDialog>
  );
}

// ---------------- Customer payment ----------------
export function PaymentDialog({ customerId, shiftId, onClose }: { customerId?: string; shiftId?: string; onClose: () => void }) {
  const t = useT();
  const { stationId } = useStationCtx();
  const { customers, balances } = useCustomers(stationId);
  const shifts = useShiftOptions(stationId);
  const [key] = useState(newKey);
  const [v, setV] = useState({ customer: customerId ?? "", amount: "", method: "cash", shift: shiftId ?? shifts[0]?.id ?? "none", at: nowLocalInput(), reference: "", notes: "" });
  const [review, setReview] = useState(false);
  const { busy, run } = useSubmit(onClose, "fin.pay.saved");
  const cust = customers.find((c) => c.id === v.customer);
  const bal = cust ? balances.get(cust.id) ?? 0 : 0;
  const amt = posNum(v.amount);
  const shiftUsed = v.method === "cash" && v.shift !== "none" ? v.shift : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!cust) return void toast.error(t("validation.selectOne"));
    if (!amt) return void toast.error(t("validation.positive"));
    setReview(true);
  }
  const confirm = () => run(() => supabase.rpc("receive_customer_payment", {
    _customer_id: v.customer, _amount: amt!, _method: v.method, _shift_id: shiftUsed as string, _occurred_at: toIso(v.at), _reference: v.reference, _notes: v.notes, _client_key: key,
  }));
  const sh = shifts.find((s) => s.id === shiftUsed);

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("fin.pay.title")} description={t("fin.pay.help")}>
      {review ? (
        <Review busy={busy} onBack={() => setReview(false)} onConfirm={() => void confirm()}
          lines={[[t("fin.customer"), cust!.name], [t("fin.amountPkr"), formatPKR(amt!)], [t("fin.method"), t(`fin.m.${v.method}` as TranslationKey)],
            [t("fin.drawer"), sh ? `${sh.name} · ${sh.shift_date}` : t("fin.notInDrawer")], [t("fin.newBalance"), formatPKR(bal - amt!)]]} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="p-cust" label={t("fin.customer")}><Pick id="p-cust" value={v.customer} onChange={(x) => setV({ ...v, customer: x })} options={customers.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          {cust && <p className="rounded-lg bg-secondary p-3 text-sm">{t("fin.currentBalance")}: <b className="tabular-nums">{formatPKR(bal)}</b></p>}
          <Field id="p-amt" label={t("fin.amountPkr")}><Input id="p-amt" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="h-14 text-2xl font-semibold tabular-nums" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-m" label={t("fin.method")}><Pick id="p-m" value={v.method} onChange={(x) => setV({ ...v, method: x })} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`fin.m.${m}` as TranslationKey) }))} /></Field>
            {v.method === "cash" ? (
              <Field id="p-sh" label={t("fin.drawer")} help={t("fin.pay.drawerHelp")}>
                <Pick id="p-sh" value={v.shift} onChange={(x) => setV({ ...v, shift: x })} options={[...shifts.map((s) => ({ value: s.id, label: `${s.name} · ${s.shift_date}` })), { value: "none", label: t("fin.notInDrawer") }]} />
              </Field>
            ) : <p className="self-end text-xs text-muted-foreground">{t("fin.pay.digitalHelp")}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-at" label={t("fin.date")}><Input id="p-at" type="datetime-local" value={v.at} max={nowLocalInput()} onChange={(e) => setV({ ...v, at: e.target.value })} className="h-12" /></Field>
            <Field id="p-ref" label={t("fin.reference")}><Input id="p-ref" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className="h-12" /></Field>
          </div>
          <Field id="p-notes" label={t("supplier.notes")}><Textarea id="p-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={300} /></Field>
          <FormButtons onCancel={onClose} />
        </form>
      )}
    </FormDialog>
  );
}

// ---------------- Supplier payment ----------------
export function PaySupplierDialog({ supplierId, outstanding, onClose }: { supplierId?: string; outstanding?: (id: string) => number; onClose: () => void }) {
  const t = useT();
  const { stationId } = useStationCtx();
  const [s] = useSuspenseQueries({ queries: [suppliersQuery(stationId)] });
  const [key] = useState(newKey);
  const [v, setV] = useState({ supplier: supplierId ?? "", amount: "", method: "bank", at: nowLocalInput(), reference: "", notes: "" });
  const [review, setReview] = useState(false);
  const { busy, run } = useSubmit(onClose, "fin.sp.saved");
  const sup = s.data.find((x) => x.id === v.supplier);
  const amt = posNum(v.amount);
  const out = sup && outstanding ? outstanding(sup.id) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!sup) return void toast.error(t("validation.selectOne"));
    if (!amt) return void toast.error(t("validation.positive"));
    setReview(true);
  }
  const confirm = () => run(() => supabase.rpc("pay_supplier", { _supplier_id: v.supplier, _amount: amt!, _method: v.method, _paid_at: toIso(v.at), _reference: v.reference, _notes: v.notes, _client_key: key }));

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("fin.sp.title")} description={t("fin.sp.help")}>
      {review ? (
        <Review busy={busy} onBack={() => setReview(false)} onConfirm={() => void confirm()}
          lines={[[t("fin.supplier"), sup!.business_name], [t("fin.amountPkr"), formatPKR(amt!)], [t("fin.method"), t(`fin.m.${v.method}` as TranslationKey)], [t("fin.reference"), v.reference || "—"],
            ...(out !== null ? [[t("fin.outstandingAfter"), formatPKR(out - amt!)] as [string, string]] : [])]} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="sp-s" label={t("fin.supplier")}><Pick id="sp-s" value={v.supplier} onChange={(x) => setV({ ...v, supplier: x })} options={s.data.filter((x) => x.is_active).map((x) => ({ value: x.id, label: x.business_name }))} /></Field>
          {out !== null && <p className="rounded-lg bg-secondary p-3 text-sm">{t("fin.outstanding")}: <b className="tabular-nums">{formatPKR(out)}</b></p>}
          <Field id="sp-a" label={t("fin.amountPkr")}><Input id="sp-a" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="h-14 text-2xl font-semibold tabular-nums" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sp-m" label={t("fin.method")}><Pick id="sp-m" value={v.method} onChange={(x) => setV({ ...v, method: x })} options={SUPPLIER_METHODS.map((m) => ({ value: m, label: t(`fin.m.${m}` as TranslationKey) }))} /></Field>
            <Field id="sp-at" label={t("fin.date")}><Input id="sp-at" type="datetime-local" value={v.at} max={nowLocalInput()} onChange={(e) => setV({ ...v, at: e.target.value })} className="h-12" /></Field>
          </div>
          <Field id="sp-r" label={t("fin.reference")} help={t("fin.sp.refHelp")}><Input id="sp-r" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className="h-12" /></Field>
          <Field id="sp-n" label={t("supplier.notes")}><Textarea id="sp-n" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={300} /></Field>
          <FormButtons onCancel={onClose} />
        </form>
      )}
    </FormDialog>
  );
}

// ---------------- Expense ----------------
export function ExpenseDialog({ shiftId, onClose }: { shiftId?: string; onClose: () => void }) {
  const t = useT();
  const { stationId } = useStationCtx();
  const shifts = useShiftOptions(stationId);
  const [c] = useSuspenseQueries({ queries: [categoriesQuery(stationId)] });
  const [key] = useState(newKey);
  const [v, setV] = useState({ category: "", description: "", amount: "", method: shiftId || shifts.length ? "drawer" : "bank", shift: shiftId ?? shifts[0]?.id ?? "", at: nowLocalInput(), reference: "" });
  const [review, setReview] = useState(false);
  const { busy, run } = useSubmit(onClose, "fin.exp.saved");
  const amt = posNum(v.amount);
  const cat = c.data.find((x) => x.id === v.category);
  const sh = shifts.find((s) => s.id === v.shift);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!cat) return void toast.error(t("validation.selectOne"));
    if (v.description.trim().length < 2) return void toast.error(t("validation.min2"));
    if (!amt) return void toast.error(t("validation.positive"));
    if (v.method === "drawer" && !sh) return void toast.error(t("fin.err.shiftRequired"));
    setReview(true);
  }
  const confirm = () => run(() => supabase.rpc("record_expense", {
    _station_id: stationId, _category_id: v.category, _occurred_at: toIso(v.at), _description: v.description, _amount: amt!,
    _method: v.method, _shift_id: (v.method === "drawer" ? v.shift : null) as string, _reference: v.reference, _client_key: key,
  }));

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("fin.exp.title")} description={t("fin.exp.help")}>
      {review ? (
        <Review busy={busy} onBack={() => setReview(false)} onConfirm={() => void confirm()}
          lines={[[t("fin.category"), catName(t, cat!.name)], [t("fin.description"), v.description], [t("fin.amountPkr"), formatPKR(amt!)],
            [t("fin.paidFrom"), v.method === "drawer" ? `${t("fin.m.drawer")} · ${sh!.name}` : t(`fin.m.${v.method}` as TranslationKey)]]} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="e-cat" label={t("fin.category")}><Pick id="e-cat" value={v.category} onChange={(x) => setV({ ...v, category: x })} options={c.data.filter((x) => x.is_active).map((x) => ({ value: x.id, label: catName(t, x.name) }))} /></Field>
            <Field id="e-at" label={t("fin.date")}><Input id="e-at" type="datetime-local" value={v.at} max={nowLocalInput()} onChange={(e) => setV({ ...v, at: e.target.value })} className="h-12" /></Field>
          </div>
          <Field id="e-d" label={t("fin.description")}><Input id="e-d" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="h-12" maxLength={200} placeholder={t("fin.exp.descPh")} /></Field>
          <Field id="e-a" label={t("fin.amountPkr")}><Input id="e-a" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="h-14 text-2xl font-semibold tabular-nums" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="e-m" label={t("fin.paidFrom")}><Pick id="e-m" value={v.method} onChange={(x) => setV({ ...v, method: x })} options={EXPENSE_METHODS.map((m) => ({ value: m, label: t(`fin.m.${m}` as TranslationKey) }))} /></Field>
            {v.method === "drawer" && (
              shifts.length ? <Field id="e-sh" label={t("fin.shift")}><Pick id="e-sh" value={v.shift} onChange={(x) => setV({ ...v, shift: x })} options={shifts.map((s) => ({ value: s.id, label: `${s.name} · ${s.shift_date}` }))} /></Field>
                : <p className="self-end text-sm text-destructive">{t("fin.needOpenShift")}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("fin.exp.methodHelp")}</p>
          <Field id="e-r" label={t("fin.receiptRef")}><Input id="e-r" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className="h-12" /></Field>
          <FormButtons onCancel={onClose} />
        </form>
      )}
    </FormDialog>
  );
}

const STARTER: Record<string, TranslationKey> = {
  Salaries: "fin.cat.salaries", Electricity: "fin.cat.electricity", Repairs: "fin.cat.repairs",
  Refreshments: "fin.cat.refreshments", "Station Supplies": "fin.cat.supplies", Other: "fin.cat.other",
};
export const catName = (t: (k: TranslationKey) => string, name: string) => (STARTER[name] ? t(STARTER[name]) : name);

export function CategoriesDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { stationId } = useStationCtx();
  const refresh = useFinanceRefresh();
  const [c] = useSuspenseQueries({ queries: [categoriesQuery(stationId)] });
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Record<string, string>>({});
  const save = async (p: PromiseLike<{ error: { message?: string } | null }>) => {
    const { error } = await p;
    if (error) return void toast.error(t(financeErrorKey(error)));
    toast.success(t("setup.saved"));
    refresh();
  };
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("fin.cat.title")} description={t("fin.cat.help")}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) return void toast.error(t("validation.min2")); void save(supabase.from("expense_categories").insert({ station_id: stationId, name: name.trim() })).then(() => setName("")); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12" placeholder={t("fin.cat.newPh")} aria-label={t("fin.cat.newPh")} maxLength={60} />
        <Button type="submit" className="h-12">{t("setup.add")}</Button>
      </form>
      <ul className="divide-y rounded-xl border">
        {c.data.map((x) => (
          <li key={x.id} className="flex items-center gap-2 p-2">
            <Input value={edit[x.id] ?? catName(t, x.name)} onChange={(e) => setEdit({ ...edit, [x.id]: e.target.value })} className="h-10" aria-label={t("fin.category")} disabled={!x.is_active} />
            {edit[x.id] !== undefined && <Button size="sm" onClick={() => void save(supabase.from("expense_categories").update({ name: edit[x.id]!.trim() }).eq("id", x.id)).then(() => setEdit({}))}>{t("common.save")}</Button>}
            <Button size="sm" variant="ghost" onClick={() => void save(supabase.from("expense_categories").update({ is_active: !x.is_active }).eq("id", x.id))}>{t(x.is_active ? "setup.archive" : "setup.restore")}</Button>
          </li>
        ))}
      </ul>
    </FormDialog>
  );
}

// ---------------- Drawer cash in/out ----------------
export function CashMoveDialog({ shiftId, kind, onClose }: { shiftId: string; kind: "cash_in" | "cash_out"; onClose: () => void }) {
  const t = useT();
  const [key] = useState(newKey);
  const [v, setV] = useState({ amount: "", reason: "" });
  const [review, setReview] = useState(false);
  const { busy, run } = useSubmit(onClose, "fin.cash.saved");
  const amt = posNum(v.amount);
  const title = t(kind === "cash_in" ? "fin.cash.inTitle" : "fin.cash.outTitle");
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={title} description={t(kind === "cash_in" ? "fin.cash.inHelp" : "fin.cash.outHelp")}>
      {review ? (
        <Review busy={busy} onBack={() => setReview(false)} onConfirm={() => void run(() => supabase.rpc("record_shift_cash_movement", { _shift_id: shiftId, _kind: kind, _amount: amt!, _reason: v.reason, _client_key: key }))}
          lines={[[title, formatPKR(amt!)], [t("tank.reason"), v.reason]]} />
      ) : (
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); if (!amt) return void toast.error(t("validation.positive")); if (v.reason.trim().length < 3) return void toast.error(t("validation.reasonMin")); setReview(true); }}>
          <Field id="cm-a" label={t("fin.amountPkr")}><Input id="cm-a" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="h-14 text-2xl font-semibold tabular-nums" /></Field>
          <Field id="cm-r" label={t("tank.reason")}><Input id="cm-r" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} className="h-12" placeholder={t(kind === "cash_in" ? "fin.cash.inPh" : "fin.cash.outPh")} maxLength={200} /></Field>
          <FormButtons onCancel={onClose} />
        </form>
      )}
    </FormDialog>
  );
}

// ---------------- Reversal (always needs a reason; nothing is deleted) ----------------
export function ReverseButton({ onReverse, label }: { onReverse: (reason: string) => PromiseLike<{ error: { message?: string } | null }>; label?: string }) {
  const t = useT();
  const refresh = useFinanceRefresh();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm"><Undo2 className="h-4 w-4" aria-hidden />{label ?? t("fin.reverse")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("fin.reverseTitle")}</DialogTitle><DialogDescription>{t("fin.reverseBody")}</DialogDescription></DialogHeader>
        <Field id="rv-r" label={t("tank.reason")}><Textarea id="rv-r" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="destructive" className="h-11" disabled={busy} onClick={async () => {
            if (reason.trim().length < 3) return void toast.error(t("validation.reasonMin"));
            setBusy(true);
            const { error } = await onReverse(reason);
            setBusy(false);
            if (error) return void toast.error(t(financeErrorKey(error)));
            toast.success(t("fin.reversed"));
            setOpen(false);
            refresh();
          }}>{t("fin.reverse")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
