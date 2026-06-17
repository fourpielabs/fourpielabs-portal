"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  clientId: string;
  isAdmin: boolean;
  clientType?: "program" | "project";
};
type Tab = { href: string; label: string; exact?: boolean };

export function ClientTabs({ clientId, isAdmin, clientType = "program" }: Props) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;
  const isProject = clientType === "project";

  // Project clients get a Projects tab and drop the program-only tabs (Checklist,
  // Program, Content, Metrics, Competitors). Program clients are unchanged.
  const primary: Tab[] = isProject
    ? [
        { href: base, label: "Overview", exact: true },
        { href: `${base}/messages`, label: "Messages" },
        { href: `${base}/projects`, label: "Projects" },
        { href: `${base}/deliverables`, label: "Deliverables" },
        { href: `${base}/tasks`, label: "Tasks" },
        { href: `${base}/calls`, label: "Calls" },
      ]
    : [
        { href: base, label: "Overview", exact: true },
        { href: `${base}/messages`, label: "Messages" },
        { href: `${base}/checklist`, label: "Checklist" },
        { href: `${base}/program`, label: "Program" },
        { href: `${base}/content`, label: "Content" },
        { href: `${base}/metrics`, label: "Metrics" },
        { href: `${base}/competitors`, label: "Competitors" },
        { href: `${base}/deliverables`, label: "Deliverables" },
        { href: `${base}/tasks`, label: "Tasks" },
        { href: `${base}/calls`, label: "Calls" },
      ];
  const more: Tab[] = [
    { href: `${base}/notes`, label: "Notes" },
    { href: `${base}/reports`, label: "Reports" },
    { href: `${base}/updates`, label: "Updates" },
    { href: `${base}/files`, label: "Files" },
  ];
  if (isAdmin) more.push({ href: `${base}/settings`, label: "Settings" });

  const isActive = (t: Tab) =>
    t.exact ? pathname === t.href : pathname.startsWith(t.href);
  const moreActive = more.some(isActive);

  const linkCls = (active: boolean) =>
    cn(
      "relative shrink-0 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors",
      active ? "font-semibold text-ink" : "font-medium text-ink-3 hover:text-ink",
    );
  // shared-layout underline that springs between tabs (reduced motion → jumps instantly)
  const underline = (
    <m.span
      layoutId="workspace-tab-underline"
      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-amber-600"
      transition={spring.snappy}
    />
  );

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {primary.map((t) => {
        const active = isActive(t);
        return (
          <Link key={t.href} href={t.href} className={linkCls(active)}>
            {t.label}
            {active && underline}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(linkCls(moreActive), "inline-flex items-center gap-1")}>
          More <ChevronDown className="size-3.5" />
          {moreActive && underline}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {more.map((t) => (
            <DropdownMenuItem key={t.href} asChild>
              <Link href={t.href} className={isActive(t) ? "font-semibold text-ink" : ""}>
                {t.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
