import { useState, type InputHTMLAttributes } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT, type TranslationKey } from "@/lib/i18n";

/** Password input with a show/hide toggle. */
export function PasswordField({
  id,
  label,
  registration,
  error,
  ...rest
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError | undefined;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} aria-invalid={!!error} className="h-11 pr-11" {...registration} {...rest} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={t(show ? "auth.hidePassword" : "auth.showPassword")}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      {error?.message && <p className="text-sm text-destructive">{t(error.message as TranslationKey)}</p>}
    </div>
  );
}
