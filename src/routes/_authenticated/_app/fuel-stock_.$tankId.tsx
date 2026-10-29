import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Gauge, Scale, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { useStationCtx } from "@/components/setup/shared";
import { AdjustDialog, DipDialog, ReceiveFuelDialog, useInventory } from "@/components/inventory/dialogs";
import { AdjustmentsList, DeliveriesTable, DipsTable, MovementsTable } from "@/components/inventory/lists";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/setup";
import { AlertBadges, tankState, useThreshold, VarianceText } from "./fuel-stock";

export const Route = createFileRoute("/_authenticated/_app/fuel-stock_/$tankId")({
  head: () => ({
    meta: [
      { title: "Tank Stock — PumpHisab" },
      { name: "description", content: "Expected stock calculation, movement history and dip readings for one tank." },
      { property: "og:title", content: "Tank Stock — PumpHisab" },
      { property: "og:description", content: "Expected stock calculation, movement history and dip readings for one tank." },
    ],
  }),
  component: TankPage,
});

const L = (n: number) => formatNumber(n, 2);

function TankPage() {
  const t = useT();
  const { tankId } = Route.useParams();
  const { stationId } = useStationCtx();
  const d = useInventory(stationId);
  const threshold = useThreshold();
  const [dialog, setDialog] = useState<"receive" | "dip" | "adjust" | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const tank = d.tanks.find((x) => x.id === tankId);
  if (!tank) return <EmptyState title={t("inv.tankNotFound")} action={<Button asChild><Link to="/fuel-stock">{t("inv.back")}</Link></Button>} />;
  const s = tankState(tank, d.movements, d.dips, threshold);
  const product = d.products.find((p) => p.id === tank.product_id)?.name ?? "";

  const line = (label: string, v: number, strong = false) => (
    <div className={cn("flex justify-between gap-4 py-1.5", strong && "border-t pt-2 text-lg font-bold")}>
      <span>{label}</span><span className="tabular-nums">{L(v)} L</span>
    </div>
  );

  return (
    <>
      <PageHeader
        title={tank.name}
        description={`${product} · ${t("inv.capacity")}: ${L(Number(tank.capacity_litres))} L`}
        actions={<Button asChild variant="outline" className="h-11"><Link to="/fuel-stock"><ChevronLeft className="h-4 w-4" aria-hidden />{t("inv.back")}</Link></Button>}
      />
      <div className="mb-4"><AlertBadges alerts={s.alerts} /></div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-card" aria-labelledby="calc-h">
          <h2 id="calc-h" className="mb-2 font-semibold">{t("inv.calc")}</h2>
          {line(t("inv.calc.opening"), s.b.opening)}
          {line(t("inv.calc.deliveries"), s.b.deliveries)}
          {line(t("inv.calc.sales"), s.b.sales)}
          {line(t("inv.calc.adjustments"), s.b.adjustments)}
          {line(t("inv.calc.expected"), s.b.expected, true)}
          <p className="mt-2 text-xs text-muted-foreground">{t("inv.expectedHelp")}</p>
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="mb-2 font-semibold">{t("inv.lastDip")}</h2>
          {s.cmp ? (
            <>
              <p className="font-display text-3xl font-bold tabular-nums">{L(Number(s.cmp.dip.measured_litres))} L</p>
              <p className="text-sm text-muted-foreground">{new Date(s.cmp.dip.measured_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</p>
              <div className="mt-3 flex justify-between text-sm"><span>{t("inv.calc.dipAt")}</span><span className="tabular-nums">{L(s.cmp.expectedAtDip)} L</span></div>
              <p className="mt-2 text-lg font-semibold"><VarianceText cmp={s.cmp} /></p>
            </>
          ) : <p className="text-muted-foreground">{t("inv.noDip")}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button className="h-12" onClick={() => setDialog("receive")}><Truck className="h-4 w-4" aria-hidden />{t("inv.receive")}</Button>
            <Button variant="outline" className="h-12" onClick={() => setDialog("dip")}><Gauge className="h-4 w-4" aria-hidden />{t("inv.dip")}</Button>
            <Button variant="outline" className="h-12" onClick={() => setDialog("adjust")}><Scale className="h-4 w-4" aria-hidden />{t("inv.adjust")}</Button>
          </div>
        </section>
      </div>

      <div className="mb-3 flex gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("inv.from")} className="h-11 sm:w-44" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("inv.to")} className="h-11 sm:w-44" />
      </div>
      <Tabs defaultValue="movements">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="movements" className="h-10">{t("inv.movements")}</TabsTrigger>
          <TabsTrigger value="dips" className="h-10">{t("inv.dips")}</TabsTrigger>
          <TabsTrigger value="deliveries" className="h-10">{t("inv.deliveries")}</TabsTrigger>
          <TabsTrigger value="adjustments" className="h-10">{t("inv.adjustments")}</TabsTrigger>
        </TabsList>
        <TabsContent value="movements"><MovementsTable movements={s.mv} tanks={d.tanks} from={from} to={to} showBalance /></TabsContent>
        <TabsContent value="dips"><DipsTable dips={d.dips.filter((x) => x.tank_id === tank.id)} /></TabsContent>
        <TabsContent value="deliveries"><DeliveriesTable deliveries={d.deliveries.filter((x) => x.tank_id === tank.id)} tanks={d.tanks} suppliers={d.suppliers} /></TabsContent>
        <TabsContent value="adjustments"><AdjustmentsList adjustments={d.adjustments.filter((a) => a.tank_id === tank.id)} tanks={d.tanks} /></TabsContent>
      </Tabs>

      {dialog === "receive" && <ReceiveFuelDialog onClose={() => setDialog(null)} defaultTank={tank.id} />}
      {dialog === "dip" && <DipDialog onClose={() => setDialog(null)} defaultTank={tank.id} />}
      {dialog === "adjust" && <AdjustDialog onClose={() => setDialog(null)} defaultTank={tank.id} />}
    </>
  );
}
