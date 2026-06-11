"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  FileText,
  Home,
  Megaphone,
  MoreHorizontal,
  Package,
  Phone,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

type Item = { href: string; label: string };

const TOP: Item[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/program", label: "Program" },
  { href: "/content", label: "Content" },
  { href: "/performance", label: "Performance" },
  { href: "/deliverables", label: "Deliverables" },
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
  { href: "/deliverables", label: "Deliverables", icon: Package },
  { href: "/calls-notes", label: "Calls & Notes", icon: Phone },
  { href: "/documents", label: "Documents", icon: FileText },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ClientShell({
  name,
  email,
  children,
}: {
  name: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(pathname, m.href));

  return (
    <div className="flex min-h-screen flex-col">
      {/* desktop top nav — full-bleed white bar */}
      <header className="sticky top-0 z-30 hidden border-b border-border bg-surface sm:block">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-7 px-8">
          <Link href="/dashboard" className="font-display text-lg font-bold tracking-tight">
            4Pie Labs<span className="text-amber-600">.</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {TOP.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13.5px] transition-colors",
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
          <form action="/auth/signout" method="post" className="contents">
            <button
              title={name ?? email ?? "Account"}
              type="submit"
              className="inline-flex size-[38px] items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800"
            >
              {initials(name, email)}
            </button>
          </form>
        </div>
      </header>

      {/* mobile compact header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:hidden">
        <Link href="/dashboard" className="font-display text-base font-bold tracking-tight">
          4Pie Labs<span className="text-amber-600">.</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="inline-flex size-8 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800"
          >
            {initials(name, email)}
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-28 sm:px-8 sm:pt-11 sm:pb-10">
        {children}
      </main>

      {/* mobile bottom tab bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3.5 pb-3.5 sm:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-full bg-surface px-3.5 py-2 shadow-e3">
          {BOTTOM.map((b) => {
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
        </div>
      </div>

      {/* More sheet */}
      {moreOpen && (
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
              {MORE.map((m) => {
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
