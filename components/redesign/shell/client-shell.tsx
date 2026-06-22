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
import { useModalA11y } from "@/lib/use-modal-a11y";
import type { NotificationItem } from "@/lib/actions/notifications";
import { BrandLogo } from "@/components/ui/brand-logo";
import { RouteTransition } from "@/components/motion/route-transition";
import { FluentScope, ThemeToggle, useRedesignMode } from "@/components/redesign/themed-fluent";
import { NotificationBell } from "@/components/redesign/shell/notification-bell";
import { GlobalSearch } from "@/components/redesign/shell/global-search";
import { UserMenu } from "@/components/redesign/shell/user-menu";

type Item = { href: string; label: string };

// Nav destinations + role/type rules preserved verbatim from the live ClientShell.
const TOP: Item[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/messages", label: "Messages" },
  { href: "/program", label: "Program" },
  { href: "/content", label: "Content" },
  { href: "/performance", label: "Performance" },
  { href: "/results", label: "Results" },
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
const BOTTOM_PROJECT: { href: string; label: string; icon: typeof Package }[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/deliverables", label: "Deliverables", icon: Package },
  { href: "/calls-notes", label: "Calls", icon: Phone },
];
const MORE_PROJECT: { href: string; label: string; icon: typeof Package }[] = [
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/documents", label: "Documents", icon: FileText },
];
// /performance + /program + /content are program-only; /results is project-only.
const PROGRAM_ONLY = new Set(["/program", "/performance", "/content"]);
const PROJECT_ONLY = new Set(["/results"]);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useModalA11y<HTMLDivElement>(moreOpen, () => setMoreOpen(false));

  const isProject = clientType === "project";
  const top = isProject ? TOP.filter((i) => !PROGRAM_ONLY.has(i.href)) : TOP.filter((i) => !PROJECT_ONLY.has(i.href));
  const bottom = isProject ? BOTTOM_PROJECT : BOTTOM;
  const more = isProject ? MORE_PROJECT : MORE;
  const moreActive = more.some((mi) => isActive(pathname, mi.href));

  const island = (
    <FluentScope className="inline-flex items-center gap-1">
      <GlobalSearch tone={onDark ? "dark" : "light"} />
      <ThemeToggle tone={onDark ? "dark" : "light"} />
      <NotificationBell tone={onDark ? "dark" : "light"} initialUnread={notifUnread} initialItems={notifItems} />
      <UserMenu name={name} email={email} avatarUrl={avatarUrl} tone={onDark ? "dark" : "light"} />
    </FluentScope>
  );

  return (
    <div data-density="spacious" className="rd-root flex min-h-screen flex-col">
      {/* desktop ember-glass pill nav */}
      <header className="sticky top-0 z-30 hidden px-4 pt-4 sm:block">
        <div
          className={cn(
            "rd-glass rd-glass--strong mx-auto flex h-14 w-fit max-w-full items-center gap-6 rounded-full px-6",
            onDark && "rd-glass--dark",
          )}
        >
          <Link href="/dashboard" className="rd-focus rounded-md">
            <BrandLogo className="text-lg" dark={onDark} />
          </Link>
          <nav className="flex items-center gap-1">
            {top.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rd-focus motion-micro rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
                    active
                      ? onDark
                        ? "bg-[rgba(245,158,11,0.16)] font-semibold text-[#fbbf24]"
                        : "bg-[rgba(217,119,6,0.12)] font-semibold text-[#b45309]"
                      : onDark
                        ? "text-[#b3aca0] hover:text-[#f3efe7]"
                        : "text-ink-2 hover:text-ink",
                  )}
                >
                  {i.label}
                </Link>
              );
            })}
          </nav>
          <span className={cn("h-6 w-px", onDark ? "bg-white/15" : "bg-border")} />
          {island}
        </div>
      </header>

      {/* mobile ember-glass header */}
      <header
        className={cn(
          "rd-glass rd-glass--strong sticky top-0 z-30 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3 sm:hidden",
          onDark && "rd-glass--dark",
        )}
      >
        <Link href="/dashboard" className="rd-focus rounded-md">
          <BrandLogo className="text-base" dark={onDark} />
        </Link>
        {island}
      </header>

      {/* page body — outside FluentProvider (converted bodies bring their own FluentScope) */}
      {/* `isolate`: same guarantee as the staff rail — the page's fixed ambient
          field is confined to <main>'s stacking context, so it can never out-stack
          the top/bottom nav chrome (z-30 siblings). Parity hardening. */}
      <main className="w-full flex-1 scroll-pb-36 pt-6 pb-36 sm:pt-10 sm:pb-10 isolate">
        <RouteTransition>{children}</RouteTransition>
      </main>

      {/* mobile ember-glass bottom tab bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3.5 pb-3.5 sm:hidden">
        <nav
          aria-label="Primary"
          className={cn(
            "rd-glass rd-glass--strong mx-auto flex max-w-md items-center justify-between rounded-full px-3.5 py-2",
            onDark && "rd-glass--dark",
          )}
        >
          {bottom.map((b) => {
            const active = isActive(pathname, b.href);
            const Icon = b.icon;
            return (
              <Link
                key={b.href}
                href={b.href}
                aria-current={active ? "page" : undefined}
                aria-label={b.label}
                className="rd-focus flex flex-col items-center gap-0.5 rounded-2xl"
              >
                <span
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-full transition-colors",
                    active
                      ? "bg-[#b45309] text-white"
                      : onDark
                        ? "text-[#b3aca0]"
                        : "text-ink-2",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <span
                  className={cn(
                    "text-[9.5px] font-medium",
                    active ? (onDark ? "text-[#fbbf24]" : "text-[#b45309]") : onDark ? "text-[#9a948b]" : "text-ink-3",
                  )}
                >
                  {b.label}
                </span>
              </Link>
            );
          })}
          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="More"
              className="rd-focus flex flex-col items-center gap-0.5 rounded-2xl"
            >
              <span
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full transition-colors",
                  moreActive ? "bg-[#b45309] text-white" : onDark ? "text-[#b3aca0]" : "text-ink-2",
                )}
              >
                <MoreHorizontal className="size-5" />
              </span>
              <span className={cn("text-[9.5px] font-medium", onDark ? "text-[#9a948b]" : "text-ink-3")}>More</span>
            </button>
          )}
        </nav>
      </div>

      {/* More bottom-sheet (custom — Fluent Drawer is side-only; keeps useModalA11y focus trap) */}
      {moreOpen && more.length > 0 && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMoreOpen(false)} />
          <div
            ref={moreRef}
            role="dialog"
            aria-modal="true"
            aria-label="More menu"
            tabIndex={-1}
            className={cn(
              "rd-glass rd-glass--strong absolute inset-x-0 bottom-0 rounded-t-2xl rounded-b-none border-x-0 border-b-0 p-4 pb-8 outline-none",
              onDark && "rd-glass--dark",
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={cn("font-display text-base font-semibold", onDark ? "text-[#f3efe7]" : "text-ink")}>More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className={cn(
                  "rd-focus inline-flex size-9 items-center justify-center rounded-full",
                  onDark ? "text-[#b3aca0] hover:bg-white/[0.08]" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <X className="size-5" />
              </button>
            </div>
            <nav aria-label="More" className="flex flex-col">
              {more.map((mi) => {
                const Icon = mi.icon;
                return (
                  <Link
                    key={mi.href}
                    href={mi.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "rd-focus flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                      onDark ? "text-[#f3efe7] hover:bg-white/[0.06]" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    <Icon className={cn("size-5", onDark ? "text-[#b3aca0]" : "text-ink-2")} />
                    {mi.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
