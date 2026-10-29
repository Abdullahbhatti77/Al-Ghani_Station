import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Droplets, Gauge, Scale, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { useStationCtx } from "@/components/setup/shared";
import { AdjustDialog, DipDialog, ReceiveFuelDialog, useInventory } from "@/components/inventory/dialogs";
import { AdjustmentsList, DeliveriesTable, MovementsTable } from "@/components/inventory/lists";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatNumber, type Tank } from "@/lib/setup";
import { myStationQuery } from "@/lib/station";
import { breakdown, compareDip, tankAlerts, type StockMovement, type TankDip } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/_app/fuel-stock")({
  head: () => ({
    meta: [
      { title: "Fuel Stock — PumpHisab" },
      { name: "description", content: "Expected tank stock, fuel deliveries, dip readings and stock adjustments for your station." },
      { property: "og:title", content: "Fuel Stock — PumpHisab" },
      { property: "og:description", content: "Expected tank stock, fuel deliveries, dip readings and stock adjustments for your station." },
    ],
  }),
  component: FuelStockPage,
});

const L = (n: number) => formatNumber(n, 2);
type Dialog = "receive" | "dip" | "adjust" | null;

export function useThreshold() {
  const { data } = useSuspenseQuery(myStationQuery);
  const v = (data?.station as { dip_variance_litres?: number | null } | undefined)?.dip_variance_litres;
  return v === null || v === undefined ? null : Number(v);
}

export function tankState(tank: Tank, movements: StockMovement[], dips: TankDip[], threshold: number | null) {
  const mv = movements.filter((m) => m.tank_id === tank.id);
  const b = breakdown(mv);
  const cmp = compareDip(mv, dips.filter((d) => d.tank_id === tank.id));
  return { b, cmp, alerts: tankAlerts(tank, b.expected, cmp, threshold), mv };
}

export function VarianceText({ cmp }: { cmp: ReturnType<typeof compareDip> }) {
  const t = useT();
  if (!cmp) return <span className="text-muted-foreground">—</span>;
  const v = L(Math.abs(cmp.difference));
  if (cmp.status === "equal") return <span className="text-success">{t("inv.equal")}</span>;
  return <span className={cmp.status === "below" ? "text-destructive" : "text-warning-foreground"}>{t(cmp.status === "below" ? "inv.below" : "inv.above", { v })}</span>;
}

export function AlertBadges({ alerts }: { alerts: string[] }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1">
      {alerts.map((a) => (
        <Badge key={a} className={a === "low" ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}>
          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />{t(`inv.alert.${a}` as TranslationKey)}
        </Badge>
      ))}
    </div>
  );
}

function FuelStockPage() {
  const t = useT();
  const { stationId } = useStationCtx();
  const d = useInventory(stationId);
  const threshold = useThreshold();
  const [product, setProduct] = useState("all");
  const [tankF, setTankF] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const tanks = d.tanks.filter((x) => x.is_active && (product === "all" || x.product_id === product) && (tankF === "all" || x.id === tankF));
  const tankIds = new Set(tanks.map((x) => x.id));
  const pName = (id: string) => d.products.find((p) => p.id === id)?.name ?? "—";
  const pending = d.adjustments.filter((a) => a.status === "pending" && tankIds.has(a.tank_id));
  const inRange = (iso: string) => (!from || iso.slice(0, 10) >= from) && (!to || iso.slice(0, 10) <= to);

  return (
    <>
      <PageHeader title={t("inv.title")} description={t("inv.desc")} />
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        <Button size="lg" className="h-14 text-base" onClick={() => setDialog("receive")}><Truck className="h-5 w-5" aria-hidden />{t("inv.receive")}</Button>
        <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setDialog("dip")}><Gauge className="h-5 w-5" aria-hidden />{t("inv.dip")}</Button>
        <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setDialog("adjust")}><Scale className="h-5 w-5" aria-hidden />{t("inv.adjust")}</Button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Select value={product} onValueChange={(v) => { setProduct(v); setTankF("all"); }}>
          <SelectTrigger className="h-11" aria-label={t("inv.f.product")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inv.allProducts")}</SelectItem>
            {d.products.filter((p) => p.is_fuel).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tankF} onValueChange={setTankF}>
          <SelectTrigger className="h-11" aria-label={t("inv.col.tank")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inv.allTanks")}</SelectItem>
            {d.tanks.filter((x) => x.is_active && (product === "all" || x.product_id === product)).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("inv.from")} className="h-11" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("inv.to")} className="h-11" />
      </div>

      {tanks.length === 0 ? (
        <EmptyState title={t("inv.noTanks")} icon={<Droplets className="h-6 w-6" aria-hidden />} />
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tanks.map((tank) => {
            const s = tankState(tank, d.movements, d.dips, threshold);
            const cap = Number(tank.capacity_litres);
            return (
              <Link key={tank.id} to="/fuel-stock/$tankId" params={{ tankId: tank.id }}
                className={cn("block rounded-2xl border bg-card p-5 shadow-card transition-colors hover:border-primary", s.alerts.some((a) => a !== "low") && "border-destructive")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{tank.name}</p>
                    <p className="text-sm text-muted-foreground">{pName(tank.product_id)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" aria-label={t("inv.details")} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t("inv.expected")}</p>
                <p className={cn("font-display text-3xl font-bold tabular-nums", s.b.expected < 0 && "text-destructive")}>{L(s.b.expected)} L</p>
                <Progress value={Math.max(0, Math.min(100, (s.b.expected / cap) * 100))} className="my-2 h-2" />
                <p className="text-xs text-muted-foreground">{t("inv.capacity")}: {L(cap)} L</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t("inv.lastDip")}</p>
                    <p className="font-semibold tabular-nums">{s.cmp ? `${L(Number(s.cmp.dip.measured_litres))} L` : t("inv.noDip")}</p>
                    {s.cmp && <p className="text-xs text-muted-foreground">{new Date(s.cmp.dip.measured_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</p>}
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("inv.variance")}</p>
                    <p className="font-semibold"><VarianceText cmp={s.cmp} /></p>
                  </div>
                </div>
                <div className="mt-3"><AlertBadges alerts={s.alerts} /></div>
              </Link>
            );
          })}
        </div>
      )}

      <Tabs defaultValue={pending.length ? "adjustments" : "movements"}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="movements" className="h-10">{t("inv.movements")}</TabsTrigger>
          <TabsTrigger value="deliveries" className="h-10">{t("inv.deliveries")}</TabsTrigger>
          <TabsTrigger value="adjustments" className="h-10">{t("inv.adjustments")}{pending.length > 0 && <Badge className="ml-2 bg-warning text-warning-foreground">{pending.length}</Badge>}</TabsTrigger>
        </TabsList>
        <TabsContent value="movements"><MovementsTable movements={d.movements.filter((m) => tankIds.has(m.tank_id))} tanks={d.tanks} from={from} to={to} /></TabsContent>
        <TabsContent value="deliveries"><DeliveriesTable deliveries={d.deliveries.filter((x) => tankIds.has(x.tank_id) && inRange(x.delivered_at))} tanks={d.tanks} suppliers={d.suppliers} /></TabsContent>
        <TabsContent value="adjustments"><AdjustmentsList adjustments={d.adjustments.filter((a) => tankIds.has(a.tank_id) && inRange(a.requested_at))} tanks={d.tanks} /></TabsContent>
      </Tabs>

      {dialog === "receive" && <ReceiveFuelDialog onClose={() => setDialog(null)} {...(tankF !== "all" ? { defaultTank: tankF } : {})} />}
      {dialog === "dip" && <DipDialog onClose={() => setDialog(null)} {...(tankF !== "all" ? { defaultTank: tankF } : {})} />}
      {dialog === "adjust" && <AdjustDialog onClose={() => setDialog(null)} {...(tankF !== "all" ? { defaultTank: tankF } : {})} />}
    </>
  );
}
