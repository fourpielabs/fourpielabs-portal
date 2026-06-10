"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = { clientId: string; isAdmin: boolean };

export function ClientTabs({ clientId, isAdmin }: Props) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;

  const tabs: { href: string; label: string; exact?: boolean }[] = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/checklist`, label: "Checklist" },
    { href: `${base}/program`, label: "Program" },
    { href: `${base}/content`, label: "Content" },
    { href: `${base}/metrics`, label: "Metrics" },
    { href: `${base}/competitors`, label: "Competitors" },
    { href: `${base}/deliverables`, label: "Deliverables" },
    { href: `${base}/calls`, label: "Calls" },
    { href: `${base}/notes`, label: "Notes" },
    { href: `${base}/reports`, label: "Reports" },
    { href: `${base}/updates`, label: "Updates" },
    { href: `${base}/files`, label: "Files" },
  ];
  if (isAdmin) tabs.push({ href: `${base}/settings`, label: "Settings" });

  return (
    <nav className="flex gap-1 overflow-x-auto border-b pb-px">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
