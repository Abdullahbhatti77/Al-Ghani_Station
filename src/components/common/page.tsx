import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** A big-number tile. `value === null` means nothing is stored yet — never show a fake number. */
export function StatCard({
  label,
  value,
  emptyLabel,
  hint,
  storedLabel,
}: {
  label: string;
  value: string | null;
  emptyLabel: string;
  hint?: string;
  storedLabel?: string;
}) {
  const empty = value === null;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {!empty && storedLabel && <Badge className="bg-success text-success-foreground">{storedLabel}</Badge>}
      </div>
      <p className={cn("mt-3 font-display text-3xl font-bold tabular-nums", empty && "text-xl text-muted-foreground")}>
        {empty ? emptyLabel : value}
      </p>
      {empty && hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; className?: string };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.className}>{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={rowKey(r)}>
              {columns.map((c) => (
                <TableCell key={c.key} className={c.className}>{c.cell(r)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
