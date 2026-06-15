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
import { UserMenu } from "@/components/shell/user-menu";
import { BrandLogo } from "@/components/ui/brand-logo";

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
  avatarUrl = null,
  children,
}: {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(pathname, m.href));

  return (
    <div className="flex min-h-screen flex-col">
      {/* desktop top nav — floating rounded pill (matches fourpielabs.com) */}
      <header className="sticky top-0 z-30 hidden px-4 pt-4 sm:block">
        <div className="mx-auto flex h-14 w-fit max-w-full items-center gap-8 rounded-full border border-border bg-surface/85 px-7 shadow-e2 backdrop-blur-md">
          <Link href="/dashboard">
            <BrandLogo className="text-lg" />
          </Link>
          <nav className="flex items-center gap-2">
            {TOP.map((i) => {
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
          <UserMenu name={name} email={email} avatarUrl={avatarUrl} size="md" />
        </div>
      </header>

      {/* mobile compact header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:hidden">
        <Link href="/dashboard">
          <BrandLogo className="text-base" />
        </Link>
        <UserMenu name={name} email={email} avatarUrl={avatarUrl} size="md" />
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 scroll-pb-36 px-4 pt-6 pb-36 sm:px-8 sm:pt-11 sm:pb-10">
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
