import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useT, type TranslationKey } from "@/lib/i18n";
import { formatNumber, type Tank } from "@/lib/setup";
import { myStationQuery } from "@/lib/station";
import { breakdown, compareDip, tankAlerts, type StockMovement, type TankDip } from "@/lib/inventory";

const L = (n: number) => formatNumber(n, 2);

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

