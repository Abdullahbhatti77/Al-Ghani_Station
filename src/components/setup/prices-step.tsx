import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { FormField } from "@/components/common/form-field";
import { useI18n } from "@/lib/i18n";
import { currentPrice, dbErrorKey, formatPKR, priceSchema, pricesQuery, productsQuery, type Product } from "@/lib/setup";
import { supabase } from "@/integrations/supabase/client";
import { FormButtons, FormDialog, SelectField, StepIntro, useStationCtx } from "./shared";

type In = z.input<typeof priceSchema>;
type Out = z.output<typeof priceSchema>;

const fmtDate = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === "ur" ? "en-PK" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

export function PricesStep() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { stationId, canEdit } = useStationCtx();
  const { data: products } = useSuspenseQuery(productsQuery(stationId));
  const { data: prices } = useSuspenseQuery(pricesQuery(stationId));
  const [adding, setAdding] = useState<string | null>(null);
  const fuels = products.filter((p) => p.is_fuel && p.is_active);
  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const now = new Date();

  return (
    <>
      <StepIntro help="price.help" example="price.exampleText" />
      {fuels.length === 0 ? (
        <EmptyState title={t("price.noFuel")} />
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fuels.map((p) => {
            const cur = currentPrice(prices, p.id, now);
            return (
              <div key={p.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{p.name}</p>
                  <Badge variant="outline">{p.code}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("price.current")}</p>
                <p className={cur ? "font-display text-3xl font-bold tabular-nums" : "text-lg text-muted-foreground"}>
                  {cur ? formatPKR(Number(cur.price_per_litre)) : t("price.none")}
                </p>
                {cur && <p className="text-xs text-muted-foreground">{t("price.effective")}: {fmtDate(cur.effective_at, lang)}</p>}
                {canEdit && (
                  <Button variant="outline" className="mt-4 h-11 w-full" onClick={() => setAdding(p.id)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    {t("price.addTitle")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h3 className="mb-3 text-lg font-semibold">{t("price.history")}</h3>
      <DataTable
        rows={prices}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t("price.empty")} />}
        columns={[
          { key: "p", header: t("price.product"), cell: (r) => <span className="font-medium">{pName(r.product_id)}</span> },
          { key: "r", header: t("price.rate"), cell: (r) => <span className="tabular-nums font-semibold">{formatPKR(Number(r.price_per_litre))}</span> },
          {
            key: "e",
            header: t("price.effective"),
            cell: (r) => (
              <span className="flex items-center gap-2">
                {fmtDate(r.effective_at, lang)}
                {new Date(r.effective_at) > now && <Badge className="bg-warning text-warning-foreground">{t("price.upcoming")}</Badge>}
              </span>
            ),
          },
          { key: "n", header: t("price.note"), cell: (r) => r.note ?? "" },
          { key: "s", header: t("price.savedAt"), cell: (r) => fmtDate(r.created_at, lang) },
        ]}
      />
      {adding && (
        <PriceForm
          stationId={stationId}
          products={fuels}
          defaultProduct={adding}
          onDone={() => { setAdding(null); qc.invalidateQueries({ queryKey: ["fuel_prices", stationId] }); }}
          onCancel={() => setAdding(null)}
        />
      )}
    </>
  );
}

function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function PriceForm({ stationId, products, defaultProduct, onDone, onCancel }: { stationId: string; products: Product[]; defaultProduct: string; onDone: () => void; onCancel: () => void }) {
  const { t, lang } = useI18n();
  const [pending, setPending] = useState<Out | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(priceSchema),
    defaultValues: { product_id: defaultProduct, price_per_litre: "" as unknown as number, effective_at: localNow(), note: "" },
  });
  const e = form.formState.errors;

  async function save() {
    if (!pending) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("fuel_prices").insert({
      station_id: stationId,
      product_id: pending.product_id,
      price_per_litre: pending.price_per_litre,
      effective_at: new Date(pending.effective_at).toISOString(),
      note: pending.note?.trim() || null,
      created_by: u.user!.id,
    });
    setSaving(false);
    if (error) return void toast.error(t(dbErrorKey(error)));
    toast.success(t("setup.saved"));
    onDone();
  }

  return (
    <>
      <FormDialog open={!pending} onOpenChange={(o) => !o && onCancel()} title={t("price.addTitle")} description={t("price.help")}>
        <form onSubmit={form.handleSubmit((v) => setPending(v))} className="space-y-4" noValidate>
          <SelectField control={form.control} name="product_id" id="pr-product" label={t("price.product")} error={e.product_id} options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          <FormField id="pr-rate" type="number" inputMode="decimal" step="0.01" label={t("price.rate")} registration={form.register("price_per_litre")} error={e.price_per_litre} placeholder="265.50" />
          <FormField id="pr-eff" type="datetime-local" label={t("price.effective")} registration={form.register("effective_at")} error={e.effective_at} />
          <FormField id="pr-note" label={t("price.note")} placeholder={t("price.notePh")} registration={form.register("note")} error={e.note} />
          <FormButtons submitting={false} onCancel={onCancel} />
        </form>
      </FormDialog>
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("price.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending &&
                t("price.confirmBody", {
                  product: products.find((p) => p.id === pending.product_id)?.name ?? "",
                  rate: pending.price_per_litre.toFixed(2),
                  date: fmtDate(new Date(pending.effective_at).toISOString(), lang),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(ev) => { ev.preventDefault(); void save(); }}>
              {saving ? t("common.saving") : t("price.confirmSave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
