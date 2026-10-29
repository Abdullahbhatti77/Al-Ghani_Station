import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { useStationCtx } from "@/components/setup/shared";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatNumber, formatPKR, type Tank } from "@/lib/setup";
import { peopleQuery } from "@/lib/shifts";
import { inventoryErrorKey, withBalance, type FuelDelivery, type StockAdjustment, type StockMovement, type TankDip } from "@/lib/inventory";
import { supabase } from "@/integrations/supabase/client";
import { ReasonPrompt, useInventoryRefresh } from "./dialogs";

const L = (n: number) => formatNumber(n, 2);
const when = (d: string) => new Date(d).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });

export function usePerson() {
  const { stationId } = useStationCtx();
  const { data = [] } = useQuery(peopleQuery(stationId));
  return (id: string | null) => (id ? people(data, id) : "—");
}
const people = (d: { user_id: string; full_name: string }[], id: string) => d.find((p) => p.user_id === id)?.full_name ?? "—";

export function Signed({ v }: { v: number }) {
  return <span className={cn("font-semibold tabular-nums", v < 0 ? "text-destructive" : "text-success")}>{v > 0 ? "+" : ""}{L(v)}</span>;
}

/** Movements with running balance. Balance is only shown when a single tank is listed. */
export function MovementsTable({ movements, tanks, from, to, showBalance }: { movements: StockMovement[]; tanks: Tank[]; from?: string; to?: string; showBalance?: boolean }) {
  const t = useT();
  const person = usePerson();
  const rows = withBalance(movements)
    .filter((m) => (!from || m.occurred_at.slice(0, 10) >= from) && (!to || m.occurred_at.slice(0, 10) <= to))
    .reverse();
  const tName = (id: string) => tanks.find((x) => x.id === id)?.name ?? "—";
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      empty={<EmptyState title={t("inv.noMovements")} />}
      columns={[
        { key: "d", header: t("inv.col.date"), cell: (r) => when(r.occurred_at) },
        ...(showBalance ? [] : [{ key: "t", header: t("inv.col.tank"), cell: (r: (typeof rows)[number]) => tName(r.tank_id) }]),
        { key: "k", header: t("inv.col.type"), cell: (r) => t(`inv.kind.${r.kind}` as TranslationKey) },
        { key: "l", header: t("inv.col.litres"), className: "text-right", cell: (r) => <Signed v={Number(r.litres)} /> },
        ...(showBalance ? [{ key: "b", header: t("inv.col.balance"), className: "text-right", cell: (r: (typeof rows)[number]) => <span className="tabular-nums">{L(r.balance)}</span> }] : []),
        {
          key: "s", header: t("inv.col.source"),
          cell: (r) => r.shift_id
            ? <Link className="text-primary underline" to="/shifts/$shiftId" params={{ shiftId: r.shift_id }} search={{ step: "review" }}>{t("inv.openShift")}</Link>
            : <span className="text-sm text-muted-foreground">{r.note ?? ""}</span>,
        },
        { key: "u", header: t("inv.col.by"), cell: (r) => person(r.created_by) },
      ]}
    />
  );
}

export function DeliveriesTable({ deliveries, tanks, suppliers }: { deliveries: FuelDelivery[]; tanks: Tank[]; suppliers: { id: string; business_name: string }[] }) {
  const t = useT();
  const { canEdit } = useStationCtx();
  const person = usePerson();
  const refresh = useInventoryRefresh();
  const [reversing, setReversing] = useState<FuelDelivery | null>(null);
  return (
    <>
      <DataTable
        rows={deliveries}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t("inv.noDeliveries")} />}
        columns={[
          { key: "d", header: t("inv.col.date"), cell: (r) => when(r.delivered_at) },
          { key: "c", header: t("inv.f.challan"), cell: (r) => <span className="font-medium">{r.challan_no}</span> },
          { key: "s", header: t("inv.f.supplier"), cell: (r) => suppliers.find((s) => s.id === r.supplier_id)?.business_name ?? "—" },
          { key: "t", header: t("inv.col.tank"), cell: (r) => tanks.find((x) => x.id === r.tank_id)?.name ?? "—" },
          { key: "l", header: t("inv.col.litres"), className: "text-right", cell: (r) => <span className="tabular-nums">{L(Number(r.litres))}</span> },
          { key: "a", header: t("inv.f.invoice"), className: "text-right", cell: (r) => <span className="tabular-nums">{formatPKR(Number(r.invoice_amount))}</span> },
          { key: "u", header: t("inv.col.by"), cell: (r) => person(r.received_by) },
          {
            key: "x", header: "", className: "text-right",
            cell: (r) => r.reversed_at ? <Badge variant="secondary" title={r.reversal_reason ?? ""}>{t("inv.reversed")}</Badge>
              : canEdit ? <Button variant="outline" size="sm" onClick={() => setReversing(r)}>{t("inv.reverse")}</Button> : null,
          },
        ]}
      />
      {reversing && (
        <ReasonPrompt
          title={t("inv.reverseTitle")}
          body={t("inv.reverseBody")}
          confirmLabel={t("inv.reverse")}
          onClose={() => setReversing(null)}
          onSubmit={async (reason) => {
            const { error } = await supabase.rpc("reverse_delivery", { _delivery_id: reversing.id, _reason: reason });
            if (error) return t(inventoryErrorKey(error));
            refresh();
            return null;
          }}
        />
      )}
    </>
  );
}

export function AdjustmentsList({ adjustments, tanks }: { adjustments: StockAdjustment[]; tanks: Tank[] }) {
  const t = useT();
  const { canEdit } = useStationCtx();
  const person = usePerson();
  const refresh = useInventoryRefresh();
  const [reviewing, setReviewing] = useState<{ a: StockAdjustment; approve: boolean } | null>(null);
  return (
    <>
      <DataTable
        rows={adjustments}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t("inv.noAdjustments")} />}
        columns={[
          { key: "d", header: t("inv.col.date"), cell: (r) => when(r.requested_at) },
          { key: "t", header: t("inv.col.tank"), cell: (r) => tanks.find((x) => x.id === r.tank_id)?.name ?? "—" },
          { key: "l", header: t("inv.col.litres"), className: "text-right", cell: (r) => <Signed v={Number(r.litres)} /> },
          { key: "r", header: t("inv.f.reason"), cell: (r) => r.reason },
          { key: "u", header: t("inv.col.by"), cell: (r) => person(r.requested_by) },
          {
            key: "s", header: "", className: "text-right",
            cell: (r) => r.status === "pending" ? (
              canEdit ? (
                <div className="flex justify-end gap-1">
                  <Button size="sm" onClick={() => setReviewing({ a: r, approve: true })}>{t("inv.approve")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setReviewing({ a: r, approve: false })}>{t("inv.reject")}</Button>
                </div>
              ) : <Badge className="bg-warning text-warning-foreground">{t("inv.pending")}</Badge>
            ) : (
              <Badge variant="secondary" title={`${person(r.reviewed_by)}${r.review_note ? ` · ${r.review_note}` : ""}`}>{t(r.status === "approved" ? "inv.approved" : "inv.rejected")}</Badge>
            ),
          },
        ]}
      />
      {reviewing && (
        <ReasonPrompt
          optional
          title={t(reviewing.approve ? "inv.approve" : "inv.reject")}
          body={`${tanks.find((x) => x.id === reviewing.a.tank_id)?.name ?? ""}: ${L(Number(reviewing.a.litres))} L — ${reviewing.a.reason}`}
          confirmLabel={t(reviewing.approve ? "inv.approve" : "inv.reject")}
          onClose={() => setReviewing(null)}
          onSubmit={async (note) => {
            const { error } = await supabase.rpc("review_stock_adjustment", { _adjustment_id: reviewing.a.id, _approve: reviewing.approve, _note: note });
            if (error) return t(inventoryErrorKey(error));
            refresh();
            return null;
          }}
        />
      )}
    </>
  );
}

export function DipsTable({ dips }: { dips: TankDip[] }) {
  const t = useT();
  const person = usePerson();
  return (
    <DataTable
      rows={dips}
      rowKey={(r) => r.id}
      empty={<EmptyState title={t("inv.noDips")} />}
      columns={[
        { key: "d", header: t("inv.f.measuredAt"), cell: (r) => when(r.measured_at) },
        { key: "l", header: t("inv.f.measured"), className: "text-right", cell: (r) => <span className="font-semibold tabular-nums">{L(Number(r.measured_litres))}</span> },
        { key: "n", header: t("inv.f.notes"), cell: (r) => r.notes ?? "" },
        { key: "u", header: t("inv.col.by"), cell: (r) => person(r.created_by) },
      ]}
    />
  );
}
