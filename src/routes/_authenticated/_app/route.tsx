import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { LanguageSelect } from "@/components/common/language-select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingState } from "@/components/common/states";
import { useT } from "@/lib/i18n";
import { myStationQuery } from "@/lib/station";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app")({
  beforeLoad: async ({ context }) => {
    const mine = await context.queryClient.ensureQueryData(myStationQuery);
    if (!mine) throw redirect({ to: "/onboarding" });
  },
  pendingComponent: () => <LoadingState />,
  component: AppLayout,
});

function AppLayout() {
  const t = useT();
  const { data } = useSuspenseQuery(myStationQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success(t("auth.signedOut"));
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="print:hidden sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-5">
            <SidebarTrigger className="h-10 w-10" aria-label={t("nav.toggleSidebar")} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold">{data?.station.name}</p>
              <p className="truncate text-xs text-muted-foreground">{data?.station.city}</p>
            </div>
            <LanguageSelect className="w-[130px] sm:w-[150px]" />
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={t("nav.signOut")} title={t("nav.signOut")}>
                  <LogOut className="h-5 w-5" />
                </Button>
              }
              title={t("signOut.confirmTitle")}
              body={t("signOut.confirmBody")}
              confirmLabel={t("nav.signOut")}
              onConfirm={signOut}
            />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
