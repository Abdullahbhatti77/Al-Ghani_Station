import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function LoadingState({ label }: { label?: string }) {
  const t = useT();
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-7 w-7 text-destructive" aria-hidden />
      <h3 className="font-semibold">{t("error.title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{message ?? t("error.body")}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
