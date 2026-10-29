import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Info, Lightbulb, Pencil, Plus, Search } from "lucide-react";
import type { Control, FieldError, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useT, type TranslationKey } from "@/lib/i18n";
import { myStationQuery } from "@/lib/station";

export function useStationCtx() {
  const { data } = useSuspenseQuery(myStationQuery);
  const role = data!.role;
  return { stationId: data!.station.id, canEdit: role === "owner" || role === "manager" };
}

export function StepIntro({ help, example }: { help: TranslationKey; example: TranslationKey }) {
  const t = useT();
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <div className="flex gap-3 rounded-xl bg-secondary p-4 text-secondary-foreground">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p className="text-sm">{t(help)}</p>
      </div>
      <div className="flex gap-3 rounded-xl border border-dashed p-4">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <p className="text-sm">
          <span className="font-semibold">{t("setup.example")}: </span>
          <span className="text-muted-foreground">{t(example)}</span>
        </p>
      </div>
    </div>
  );
}

export function ListToolbar({
  search,
  onSearch,
  showArchived,
  onShowArchived,
  onAdd,
  addLabel,
  canEdit,
  addDisabled,
}: {
  search: string;
  onSearch: (v: string) => void;
  showArchived?: boolean;
  onShowArchived?: (v: boolean) => void;
  onAdd: () => void;
  addLabel: string;
  canEdit: boolean;
  addDisabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={t("setup.search")} aria-label={t("setup.search")} className="h-11 pl-9" />
      </div>
      {onShowArchived && (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!showArchived} onCheckedChange={onShowArchived} />
          {t("setup.showArchived")}
        </label>
      )}
      {canEdit && (
        <Button onClick={onAdd} disabled={addDisabled} className="h-11">
          <Plus className="h-4 w-4" aria-hidden />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  const t = useT();
  return active ? (
    <Badge className="bg-success text-success-foreground">{t("setup.active")}</Badge>
  ) : (
    <Badge variant="secondary">{t("setup.archived")}</Badge>
  );
}

export function RowActions({ active, canEdit, onEdit, onToggle }: { active: boolean; canEdit: boolean; onEdit: () => void; onToggle: () => void }) {
  const t = useT();
  if (!canEdit) return null;
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t("setup.edit")}>
        <Pencil className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">{t("setup.edit")}</span>
      </Button>
      {active ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" aria-label={t("setup.archive")}>
              <Archive className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">{t("setup.archive")}</span>
            </Button>
          }
          title={t("setup.archiveTitle")}
          body={t("setup.archiveBody")}
          confirmLabel={t("setup.archive")}
          onConfirm={onToggle}
        />
      ) : (
        <Button variant="ghost" size="sm" onClick={onToggle} aria-label={t("setup.restore")}>
          <ArchiveRestore className="h-4 w-4" aria-hidden />
          <span className="hidden md:inline">{t("setup.restore")}</span>
        </Button>
      )}
    </div>
  );
}

export function FormDialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function FormButtons({ submitting, onCancel }: { submitting: boolean; onCancel: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" className="h-11" onClick={onCancel}>{t("common.cancel")}</Button>
      <Button type="submit" className="h-11" disabled={submitting}>{submitting ? t("common.saving") : t("common.save")}</Button>
    </div>
  );
}

export function Help({ k }: { k: TranslationKey }) {
  const t = useT();
  return <p className="text-xs text-muted-foreground">{t(k)}</p>;
}

export function SelectField<F extends FieldValues>({
  control,
  name,
  id,
  label,
  options,
  error,
  disabled,
  onChangeExtra,
  placeholder,
}: {
  control: Control<F>;
  name: Path<F>;
  id: string;
  label: string;
  options: { value: string; label: string }[];
  error?: FieldError | undefined;
  disabled?: boolean;
  onChangeExtra?: (v: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={(field.value as string) ?? ""}
            onValueChange={(v) => {
              field.onChange(v);
              onChangeExtra?.(v);
            }}
            disabled={!!disabled}
          >
            <SelectTrigger id={id} className="h-11" aria-invalid={!!error}>
              <SelectValue placeholder={placeholder ?? t("validation.selectOne")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error?.message && <p className="text-sm text-destructive">{t(error.message as TranslationKey)}</p>}
    </div>
  );
}

export const matches = (q: string, ...fields: (string | number | null | undefined)[]) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(s));
};
