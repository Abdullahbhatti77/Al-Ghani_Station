import type { InputHTMLAttributes } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT, type TranslationKey } from "@/lib/i18n";

/** Labelled input. Zod messages are translation keys, translated here. */
export function FormField({
  id,
  label,
  registration,
  error,
  ...rest
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
} & InputHTMLAttributes<HTMLInputElement>) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} className="h-11" {...registration} {...rest} />
      {error?.message && (
        <p className="text-sm text-destructive">{t(error.message as TranslationKey)}</p>
      )}
    </div>
  );
}
