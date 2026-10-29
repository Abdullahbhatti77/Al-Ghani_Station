import type { ReactNode } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { formatPKR } from "@/lib/setup";
import { cn } from "@/lib/utils";

export type StatementRow = { id: string; at: string; reference: string; description: string; debit: number; credit: number; balance: number; reversed?: boolean; action?: ReactNode };

export function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-end gap-2 print:hidden">
      <div className="space-y-1"><Label htmlFor="dr-f">{t("inv.from")}</Label><Input id="dr-f" type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-11" /></div>
      <div className="space-y-1"><Label htmlFor="dr-t">{t("inv.to")}</Label><Input id="dr-t" type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-11" /></div>
    </div>
  );
}

export function StatementActions({ onCsv }: { onCsv: () => void }) {
  const t = useT();
  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" className="h-11" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />{t("fin.print")}</Button>
      <Button variant="outline" className="h-11" onClick={onCsv}><Download className="h-4 w-4" aria-hidden />{t("fin.csv")}</Button>
    </div>
  );
}

export const inRange = (iso: string, from: string, to: string) => (!from || iso.slice(0, 10) >= from) && (!to || iso.slice(0, 10) <= to);

export function StatementTable({ rows, debitLabel, creditLabel, opening }: { rows: StatementRow[]; debitLabel: string; creditLabel: string; opening: number }) {
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr>
          <th className="p-3">{t("fin.date")}</th><th className="p-3">{t("fin.reference")}</th><th className="p-3">{t("fin.description")}</th>
          <th className="p-3 text-right">{debitLabel}</th><th className="p-3 text-right">{creditLabel}</th><th className="p-3 text-right">{t("fin.balance")}</th><th className="p-3 print:hidden" />
        </tr></thead>
        <tbody>
          <tr className="border-t bg-muted/40"><td className="p-3" colSpan={5}>{t("fin.openingRow")}</td><td className="p-3 text-right font-semibold tabular-nums">{formatPKR(opening)}</td><td className="print:hidden" /></tr>
          {rows.map((r) => (
            <tr key={r.id} className={cn("border-t", r.reversed && "text-muted-foreground")}>
              <td className="p-3 whitespace-nowrap">{new Date(r.at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="p-3">{r.reference || "—"}</td>
              <td className={cn("p-3", r.reversed && "line-through")}>{r.description}</td>
              <td className="p-3 text-right tabular-nums">{r.debit ? formatPKR(r.debit) : ""}</td>
              <td className="p-3 text-right tabular-nums">{r.credit ? formatPKR(r.credit) : ""}</td>
              <td className="p-3 text-right font-semibold tabular-nums">{formatPKR(r.balance)}</td>
              <td className="p-1 text-right print:hidden">{r.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
