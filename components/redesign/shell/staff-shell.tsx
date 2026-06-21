"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  UserCog,
} from "lucide-react";
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuGroupHeader,
  Tooltip,
  OverlayDrawer,
  DrawerBody,
  Badge,
} from "@fluentui/react-components";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import type { NotificationItem } from "@/lib/actions/notifications";
import { BrandLogo } from "@/components/ui/brand-logo";
import { RouteTransition } from "@/components/motion/route-transition";
import { FluentScope, useRedesignMode } from "@/components/redesign/themed-fluent";
import { NotificationBell } from "@/components/redesign/shell/notification-bell";
import { UserMenu } from "@/components/redesign/shell/user-menu";

type NavItem = { href: string; label: string; icon: typeof Users; admin?: boolean };
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

function ClientSwitcher({ clients, onDark }: { clients: ClientOption[]; onDark: boolean }) {
  if (clients.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-xs",
          onDark ? "border-white/10 text-[#b3aca0]" : "border-border text-ink-3",
        )}
      >
        No clients yet
      </div>
    );
  }
  return (
    <Menu positioning="below-start">
      <MenuTrigger disableButtonEnhancement>
        <button
          className={cn(
            "rd-focus flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
            onDark
              ? "border-white/10 text-[#f3efe7] hover:bg-white/[0.06]"
              : "border-border text-ink hover:bg-surface-2",
          )}
        >
          <span className={cn("inline-flex size-7 items-center justify-center rounded-lg bg-amber-400/15 text-[10px] font-bold", onDark ? "text-[#fbbf24]" : "text-[#b45309]")}>
            {initials(clients[0].name, null)}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">Jump to client</span>
          <ChevronsUpDown className={cn("size-4", onDark ? "text-[#b3aca0]" : "text-ink-3")} />
        </button>
      </MenuTrigger>
      <MenuPopover>
        <MenuGroupHeader>Clients</MenuGroupHeader>
        <MenuList>
          {clients.map((c) => (
            <ClientSwitcherItem key={c.id} id={c.id} name={c.name} />
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

function ClientSwitcherItem({ id, name }: { id: string; name: string }) {
  return (
    <MenuItem onClick={() => (window.location.href = `/clients/${id}`)}>{name}</MenuItem>
  );
}

function SidebarInner({
  role,
  name,
  email,
  avatarUrl,
  clients,
  pathname,
  onDark,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  notifUnread,
  notifItems,
}: {
  role: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  clients: ClientOption[];
  pathname: string;
  onDark: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  notifUnread: number;
  notifItems: NotificationItem[];
}) {
  const nav = navFor(role);
  // layout via inline STYLE (not className): Fluent's applyStylesToPortals copies the
  // FluentScope CLASSNAME onto menu portal clones, so a leaked `h-full` made the menu's
  // portal wrapper full-viewport. Inline style fills the rail here but never reaches the clone.
  return (
    <FluentScope style={{ display: "flex", height: "100%", flexDirection: "column", gap: "1rem", padding: "0.75rem" }}>
      {/* brand + collapse (bell now lives in the top bar; theme in the user menu) */}
      <div className={cn("flex pt-2", collapsed ? "flex-col items-center gap-1" : "items-center gap-1.5 px-2")}>
        {!collapsed && (
          <Link href="/dashboard" onClick={onNavigate} className="rd-focus min-w-0 flex-1 rounded-md">
            <BrandLogo dark={onDark} className="text-lg" />
          </Link>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "rd-focus inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              onDark ? "text-[#b3aca0] hover:bg-white/[0.06] hover:text-[#f3efe7]" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>

      {/* team uses the quick switcher; admin navigates via the Clients list */}
      {!collapsed && role !== "admin" && <ClientSwitcher clients={clients} onDark={onDark} />}

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
                "rd-focus motion-micro flex items-center rounded-[10px] text-[13.5px] transition-colors",
                collapsed ? "justify-center px-0 py-2.5" : "gap-[11px] px-3 py-2.5",
                active
                  ? onDark
                    ? "bg-[rgba(245,158,11,0.16)] font-semibold text-[#fbbf24]"
                    : "bg-[rgba(217,119,6,0.12)] font-semibold text-[#b45309]"
                  : onDark
                    ? "font-medium text-[#b3aca0] hover:bg-white/[0.06] hover:text-[#f3efe7]"
                    : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.7} />
              {!collapsed && i.label}
              {!collapsed && i.admin && (
                <Badge appearance="tint" color="warning" size="extra-small" className="ml-auto">
                  Admin
                </Badge>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={i.href} content={i.admin ? `${i.label} · Admin` : i.label} relationship="label" positioning="after">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <UserMenu name={name} email={email} avatarUrl={avatarUrl} bubble role={role} collapsed={collapsed} tone={onDark ? "dark" : "light"} themeToggle />
    </FluentScope>
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
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div data-density="compact" className="rd-root flex min-h-screen">
      {/* desktop ember-glass rail.
          z-30: the rail is sticky chrome and MUST sit above the page's full-bleed ambient
          field. ClientPageFrame / StaffPageFrame / WorkspaceChrome each render a
          `position:fixed; inset:0; z-index:0` opaque field; the client TOP-NAV already
          carries z-30, but the staff rail was missing it — so on every FRAMED route
          (Clients, Users, Audit, the per-client workspace tabs) the field painted over the
          rail and it vanished. The dashboard has no frame → no field → the rail showed,
          which is exactly why ONLY the dashboard looked correct. One shell-level fix. */}
      <aside
        className={cn(
          "rd-glass rd-glass--strong rd-glass--ember motion-state sticky top-0 z-30 hidden h-screen shrink-0 rounded-none border-y-0 border-l-0 lg:block",
          onDark && "rd-glass--dark",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <SidebarInner
          role={role}
          name={name}
          email={email}
          avatarUrl={avatarUrl}
          clients={clients}
          pathname={pathname}
          onDark={onDark}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          notifUnread={notifUnread}
          notifItems={notifItems}
        />
      </aside>

      {/* `isolate`: the content column is its own stacking context, so a page's
          full-bleed ambient field (position:fixed; z-index:0) — or ANY future
          page z-index — can never out-stack the sticky rail (z-30, a sibling in
          .rd-root, which is NOT a stacking context). This is the layout-level
          root-cause guarantee the per-route z-30 patch relied on implicitly:
          the rail is now above page content BY CONSTRUCTION, not by arithmetic.
          (isolation does NOT create a containing block for fixed elements, so the
          ember field still sizes to the viewport + shows through the rail glass —
          zero visual change.) */}
      <div className="flex min-w-0 flex-1 flex-col isolate">
        {/* desktop top bar — notification bell pinned top-right (sidebar carries the
            rest of the chrome; theme toggle now lives in the user menu) */}
        <header
          className={cn(
            "rd-glass rd-glass--strong sticky top-0 z-30 hidden items-center justify-end rounded-none border-x-0 border-t-0 px-6 py-2.5 lg:flex",
            onDark && "rd-glass--dark",
          )}
        >
          <FluentScope className="inline-flex items-center">
            <NotificationBell tone={onDark ? "dark" : "light"} initialUnread={notifUnread} initialItems={notifItems} />
          </FluentScope>
        </header>

        {/* mobile ember-glass top bar */}
        <header
          className={cn(
            "rd-glass rd-glass--strong sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:hidden",
            onDark && "rd-glass--dark",
          )}
        >
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className={cn(
              "rd-focus inline-flex size-9 items-center justify-center rounded-full",
              onDark ? "text-[#b3aca0] hover:bg-white/[0.08]" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            <MenuIcon className="size-5" />
          </button>
          <Link href="/dashboard" className="rd-focus rounded-md">
            <BrandLogo className="text-base" dark={onDark} />
          </Link>
          <div className="ml-auto">
            <FluentScope className="inline-flex items-center gap-1">
              <NotificationBell tone={onDark ? "dark" : "light"} initialUnread={notifUnread} initialItems={notifItems} />
            </FluentScope>
          </div>
        </header>

        {/* page body — outside FluentProvider (converted bodies bring their own FluentScope).
            R5: RouteTransition keyed on the top-level path segment — fades top-level section
            changes; workspace TAB switches within /clients/[id]/* share the "clients" segment
            so they do NOT re-fire (the per-client tabs get the shared-layout indicator instead). */}
        <main className="w-full flex-1 py-6">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>

      {/* mobile nav drawer (Fluent Drawer = side panel; Tabster focus trap + Esc) */}
      <FluentScope>
        <OverlayDrawer
          position="start"
          open={drawer}
          onOpenChange={(_, d) => setDrawer(d.open)}
          size="small"
          className={cn("rd-root rd-glass rd-glass--strong", onDark && "rd-glass--dark")}
        >
          <DrawerBody style={{ padding: 0 }}>
            <SidebarInner
              role={role}
              name={name}
              email={email}
              avatarUrl={avatarUrl}
              clients={clients}
              pathname={pathname}
              onDark={onDark}
              onNavigate={() => setDrawer(false)}
              notifUnread={notifUnread}
              notifItems={notifItems}
            />
          </DrawerBody>
        </OverlayDrawer>
      </FluentScope>
    </div>
  );
}
