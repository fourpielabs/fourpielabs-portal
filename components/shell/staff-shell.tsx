"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  Menu,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { UserMenu } from "@/components/shell/user-menu";
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
      <div className="rounded-xl border border-border px-3 py-2 text-xs text-ink-3">
        No clients yet
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-surface-2">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-amber-100 text-[10px] font-bold text-amber-800">
            {initials(clients[0].name, null)}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">Jump to client</span>
          <ChevronsUpDown className="size-4 text-ink-3" />
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
}: {
  role: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  clients: ClientOption[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const nav = navFor(role);
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="px-2 pt-2 font-display text-lg font-bold tracking-tight"
      >
        4Pie Labs<span className="text-amber-600">.</span>
      </Link>

      {/* Admin navigates via the Clients list; the quick switcher is for team. */}
      {role !== "admin" && <ClientSwitcher clients={clients} />}

      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map((i) => {
          const active = isActive(pathname, i.href);
          const Icon = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-[13.5px] transition-colors",
                active
                  ? "bg-ink font-semibold text-white"
                  : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="size-4" strokeWidth={1.6} />
              {i.label}
              {i.admin && (
                <span className="ml-auto rounded-full bg-amber-100 px-[7px] py-0.5 text-[10px] font-bold tracking-wide text-amber-800 uppercase">
                  Admin
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
        <UserMenu name={name} email={email} avatarUrl={avatarUrl} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">
            {name ?? email}
          </span>
          <span className="block truncate text-[11px] text-ink-3 capitalize">{role}</span>
        </span>
      </div>
    </div>
  );
}

export function StaffShell({
  role,
  name,
  email,
  avatarUrl = null,
  clients,
  children,
}: {
  role: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  clients: ClientOption[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r border-border bg-surface lg:block">
        <SidebarInner
          role={role}
          name={name}
          email={email}
          avatarUrl={avatarUrl}
          clients={clients}
          pathname={pathname}
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
          <Link href="/dashboard" className="font-display text-base font-bold tracking-tight">
            4Pie Labs<span className="text-amber-600">.</span>
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-surface shadow-e3">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
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
  );
}
