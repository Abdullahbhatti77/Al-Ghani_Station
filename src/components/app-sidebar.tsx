import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ListChecks, Clock, Fuel, Users, Truck, Receipt, BarChart3, Settings, History,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useT, type TranslationKey } from "@/lib/i18n";
import { useStationCtx } from "@/components/setup/shared";
import type { Permission } from "@/lib/permissions";

export const navItems: { to: "/dashboard" | "/setup" | "/shifts" | "/fuel-stock" | "/customers" | "/suppliers" | "/expenses" | "/reports" | "/history" | "/settings"; key: TranslationKey; icon: typeof Fuel; perm?: Permission }[] = [
  { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/setup", key: "nav.setup", icon: ListChecks },
  { to: "/shifts", key: "nav.shifts", icon: Clock },
  { to: "/fuel-stock", key: "nav.fuelStock", icon: Fuel },
  { to: "/customers", key: "nav.customers", icon: Users },
  { to: "/suppliers", key: "nav.suppliers", icon: Truck },
  { to: "/expenses", key: "nav.expenses", icon: Receipt },
  { to: "/reports", key: "nav.reports", icon: BarChart3, perm: "reports.view" },
  { to: "/history", key: "nav.history", icon: History, perm: "history.view" },
  { to: "/settings", key: "nav.settings", icon: Settings },
];

export function AppSidebar() {
  const t = useT();
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { can } = useStationCtx();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Fuel className="h-4 w-4" aria-hidden />
          </span>
          {!collapsed && <span className="font-display text-lg font-bold">{t("app.name")}</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter((i) => !i.perm || can(i.perm)).map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path === item.to} tooltip={t(item.key)} size="lg">
                    <Link to={item.to} onClick={() => setOpenMobile(false)}>
                      <item.icon className="h-5 w-5" aria-hidden />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
