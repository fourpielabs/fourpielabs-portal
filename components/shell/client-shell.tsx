"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  FileText,
  Home,
  ListChecks,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Package,
  Phone,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/shell/notification-bell";
import { BrandLogo } from "@/components/ui/brand-logo";
import type { NotificationItem } from "@/lib/actions/notifications";

type Item = { href: string; label: string };

const TOP: Item[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/messages", label: "Messages" },
  { href: "/program", label: "Program" },
  { href: "/content", label: "Content" },
  { href: "/performance", label: "Performance" },
  { href: "/deliverables", label: "Deliverables" },
  { href: "/tasks", label: "Tasks" },
  { href: "/calls-notes", label: "Calls & Notes" },
  { href: "/documents", label: "Documents" },
];

const BOTTOM = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/program", label: "Program", icon: Megaphone },
  { href: "/content", label: "Content", icon: CalendarDays },
  { href: "/performance", label: "Numbers", icon: BarChart3 },
] as const;

const MORE: { href: string; label: string; icon: typeof Package }[] = [
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/deliverables", label: "Deliverables", icon: Package },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/calls-notes", label: "Calls & Notes", icon: Phone },
  { href: "/documents", label: "Documents", icon: FileText },
];

// Project clients' mobile bar — only their applicable tabs.
const BOTTOM_PROJECT: { href: string; label: string; icon: typeof Package }[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/deliverables", label: "Deliverables", icon: Package },
  { href: "/calls-notes", label: "Calls", icon: Phone },
];
const MORE_PROJECT: { href: string; label: string; icon: typeof Package }[] = [
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/documents", label: "Documents", icon: FileText },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Program-only tabs — hidden (presentation only) for `project` clients. Route
// guards still redirect these URLs to /dashboard, so it's handled, not errored.
const PROGRAM_ONLY = new Set(["/program", "/performance", "/content"]);

export function ClientShell({
  name,
  email,
  avatarUrl = null,
  clientType = "program",
  notifUnread = 0,
  notifItems = [],
  children,
}: {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  clientType?: "program" | "project";
  notifUnread?: number;
  notifItems?: NotificationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isProject = clientType === "project";
  const top = isProject ? TOP.filter((i) => !PROGRAM_ONLY.has(i.href)) : TOP;
  const bottom = isProject ? BOTTOM_PROJECT : BOTTOM;
  const more = isProject ? MORE_PROJECT : MORE;
  const moreActive = more.some((m) => isActive(pathname, m.href));

  return (
    <div data-density="spacious" className="flex min-h-screen flex-col">
      {/* desktop top nav — floating rounded pill (matches fourpielabs.com) */}
      <header className="sticky top-0 z-30 hidden px-4 pt-4 sm:block">
        <div className="mx-auto flex h-14 w-fit max-w-full items-center gap-8 rounded-full border border-border bg-surface/85 px-7 shadow-e2 backdrop-blur-md">
          <Link href="/dashboard">
            <BrandLogo className="text-lg" />
          </Link>
          <nav className="flex items-center gap-2">
            {top.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cn(
                    "motion-micro rounded-full px-4 py-1.5 text-[13.5px]",
                    active
                      ? "bg-surface-2 font-semibold text-ink"
                      : "font-medium text-ink-2 hover:bg-bg hover:text-ink",
                  )}
                >
                  {i.label}
                </Link>
              );
            })}
          </nav>
          <span className="h-6 w-px bg-border" />
          <NotificationBell initialUnread={notifUnread} initialItems={notifItems} />
          <UserMenu name={name} email={email} avatarUrl={avatarUrl} size="md" />
        </div>
      </header>

      {/* mobile compact header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:hidden">
        <Link href="/dashboard">
          <BrandLogo className="text-base" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell initialUnread={notifUnread} initialItems={notifItems} />
          <UserMenu name={name} email={email} avatarUrl={avatarUrl} size="md" />
        </div>
      </header>

      {/* width + side-padding are owned by <PageContainer> per page; the shell keeps
          only vertical rhythm + the mobile bottom-bar safe area. */}
      <main className="w-full flex-1 scroll-pb-36 pt-6 pb-36 sm:pt-11 sm:pb-10">
        {children}
      </main>

      {/* mobile bottom tab bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3.5 pb-3.5 sm:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-full bg-surface px-3.5 py-2 shadow-e3">
          {bottom.map((b) => {
            const active = isActive(pathname, b.href);
            const Icon = b.icon;
            return (
              <Link
                key={b.href}
                href={b.href}
                className="flex flex-col items-center gap-0.5"
                aria-label={b.label}
              >
                <span
                  className={cn(
                    "inline-flex size-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-ink text-white" : "text-ink-2",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.6} />
                </span>
                <span className={cn("text-[9.5px]", active ? "font-semibold text-ink" : "text-ink-3")}>
                  {b.label}
                </span>
              </Link>
            );
          })}
          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-0.5"
              aria-label="More"
            >
              <span
                className={cn(
                  "inline-flex size-12 items-center justify-center rounded-full transition-colors",
                  moreActive ? "bg-ink text-white" : "text-ink-2",
                )}
              >
                <MoreHorizontal className="size-5" />
              </span>
              <span className={cn("text-[9.5px]", moreActive ? "font-semibold text-ink" : "text-ink-3")}>
                More
              </span>
            </button>
          )}
        </div>
      </div>

      {/* More sheet */}
      {moreOpen && more.length > 0 && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-4 pb-8 shadow-e3">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-base font-semibold">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col">
              {more.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink hover:bg-surface-2"
                  >
                    <Icon className="size-5 text-ink-2" />
                    {m.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
