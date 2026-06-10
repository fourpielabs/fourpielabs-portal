"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function PortalNav({
  items,
  className,
}: {
  items: NavItem[];
  className?: string;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className={className}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "whitespace-nowrap rounded-md px-2 py-1 text-sm transition-colors",
            isActive(i.href)
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
