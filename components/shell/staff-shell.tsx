"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/shell/notification-bell";
import { BrandLogo } from "@/components/ui/brand-logo";
import { RouteTransition } from "@/components/motion/route-transition";
import { useModalA11y } from "@/lib/use-modal-a11y";
import type { NotificationItem } from "@/lib/actions/notifications";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Users;
  admin?: boolean;
};

export type ClientOption = { id: string; name: string };

function navFor(role: string): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Users },
  ];
  if (role === "admin") {
    items.push(
      { href: "/admin/users", label: "Users", icon: UserCog, admin: true },
      { href: "/admin/audit", label: "Audit log", icon: FileText, admin: true },
    );
  }
  return items;
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ClientSwitcher({ clients }: { clients: ClientOption[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-dark-border px-3 py-2 text-xs text-dark-ink-2">
        No clients yet
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="motion-micro flex w-full items-center gap-2 rounded-xl border border-dark-border px-3 py-2 text-left text-sm text-dark-ink hover:bg-white/[0.06]">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-amber-400/15 text-[10px] font-bold text-amber-300">
            {initials(clients[0].name, null)}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">Jump to client</span>
          <ChevronsUpDown className="size-4 text-dark-ink-2" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Clients</DropdownMenuLabel>
        {clients.map((c) => (
          <DropdownMenuItem key={c.id} asChild>
            <Link href={`/clients/${c.id}`}>{c.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarInner({
  role,
  name,
  email,
  avatarUrl,
  clients,
  pathname,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  bell,
}: {
  role: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  clients: ClientOption[];
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  bell?: React.ReactNode;
}) {
  const nav = navFor(role);
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      {/* brand + bell + collapse toggle */}
      <div
        className={cn(
          "flex pt-2",
          collapsed ? "flex-col items-center gap-1" : "items-center gap-2 px-2",
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" onClick={onNavigate} className="min-w-0 flex-1">
            <BrandLogo dark className="text-lg text-dark-ink" />
          </Link>
        )}
        {bell}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="motion-micro inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-dark-ink-2 hover:bg-white/[0.06] hover:text-dark-ink"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        )}
      </div>

      {/* Admin navigates via the Clients list; the quick switcher is for team. */}
      {!collapsed && role !== "admin" && <ClientSwitcher clients={clients} />}

      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map((i) => {
          const active = isActive(pathname, i.href);
          const Icon = i.icon;
          const link = (
            <Link
              key={i.href}
              href={i.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "motion-micro flex items-center rounded-[10px] text-[13.5px]",
                collapsed ? "justify-center px-0 py-2.5" : "gap-[11px] px-3 py-2.5",
                active
                  ? "bg-amber-500/15 font-semibold text-amber-300"
                  : "font-medium text-dark-ink-2 hover:bg-white/[0.06] hover:text-dark-ink",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.7} />
              {!collapsed && i.label}
              {!collapsed && i.admin && (
                <span className="ml-auto rounded-full bg-amber-400/15 px-[7px] py-0.5 text-[10px] font-bold tracking-wide text-amber-300 uppercase">
                  Admin
                </span>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={i.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">
                {i.label}
                {i.admin ? " · Admin" : ""}
              </TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <UserMenu
        name={name}
        email={email}
        avatarUrl={avatarUrl}
        size="md"
        bubble
        role={role}
        collapsed={collapsed}
        tone="dark"
      />
    </div>
  );
}

export function StaffShell({
  role,
  name,
  email,
  avatarUrl = null,
  clients,
  notifUnread = 0,
  notifItems = [],
  children,
}: {
  role: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  clients: ClientOption[];
  notifUnread?: number;
  notifItems?: NotificationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const drawerRef = useModalA11y<HTMLDivElement>(drawer, () => setDrawer(false));

  return (
    <TooltipProvider delayDuration={200}>
      <div data-density="compact" className="flex min-h-screen">
        {/* desktop sidebar (dark rail) */}
        <aside
          className={cn(
            "motion-state sticky top-0 hidden h-screen shrink-0 border-r border-dark-border bg-[#141416] lg:block",
            collapsed ? "w-[76px]" : "w-[264px]",
          )}
          style={{ backgroundImage: "var(--dark-glow-rail)" }}
        >
          <SidebarInner
            role={role}
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            clients={clients}
            pathname={pathname}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
            bell={
              <NotificationBell
                tone="dark"
                initialUnread={notifUnread}
                initialItems={notifItems}
              />
            }
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <Link href="/dashboard">
              <BrandLogo className="text-base" />
            </Link>
            <div className="ml-auto">
              <NotificationBell initialUnread={notifUnread} initialItems={notifItems} />
            </div>
          </header>

          {/* width + side-padding are owned by <PageContainer> per page. */}
          <main className="w-full flex-1 py-6">
            <RouteTransition>{children}</RouteTransition>
          </main>
        </div>

        {/* mobile drawer (dark rail) */}
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              tabIndex={-1}
              className="absolute inset-y-0 left-0 w-[280px] border-r border-dark-border bg-[#141416] shadow-e3 outline-none"
              style={{ backgroundImage: "var(--dark-glow-rail)" }}
            >
              <div className="flex justify-end p-2">
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  className="inline-flex size-9 items-center justify-center rounded-full text-dark-ink-2 hover:bg-white/[0.06] hover:text-dark-ink"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>
              <SidebarInner
                role={role}
                name={name}
                email={email}
                avatarUrl={avatarUrl}
                clients={clients}
                pathname={pathname}
                onNavigate={() => setDrawer(false)}
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
