"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { m } from "motion/react";
import { ChevronDown, Settings } from "lucide-react";
import { spring, useReducedMotion } from "@/lib/motion";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { formatMonthYear } from "@/lib/format";
import {
  Avatar, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Eyebrow, StatusPill, tokens,
} from "@/components/redesign/ui";
import { FluentScope, useRedesignMode } from "@/components/redesign/themed-fluent";
import { AmbientField } from "@/components/redesign/ui";

export type WorkspaceClient = {
  id: string; name: string; slug: string; status: string; program: string;
  client_type: "program" | "project"; start_date: string | null; logo_url: string | null;
};

type Tab = { href: string; label: string; exact?: boolean };

/**
 * R3 staff per-client workspace chrome (ember-glass) — converts the [clientId] layout
 * header + ClientTabs. Tab destinations + program/project + admin gating preserved
 * verbatim. The field + chrome live here; converted tab bodies render plain content
 * inside the same FluentScope, unconverted bodies stay readable in light mode.
 */
export function WorkspaceChrome({
  client, isAdmin, dayLabel, children,
}: {
  client: WorkspaceClient; isAdmin: boolean; dayLabel: string | null; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  const base = `/clients/${client.id}`;
  const isProject = client.client_type === "project";
  // per-tab width (metrics = wide 1440, others standard 1200) — matches WorkspaceContainer
  const maxW = /\/clients\/[^/]+\/metrics(\/|$)/.test(pathname) ? "90rem" : "75rem";

  const primary: Tab[] = isProject
    ? [
        { href: base, label: "Overview", exact: true },
        { href: `${base}/messages`, label: "Messages" },
        { href: `${base}/projects`, label: "Projects" },
        { href: `${base}/deliverables`, label: "Deliverables" },
        { href: `${base}/tasks`, label: "Tasks" },
        { href: `${base}/metrics`, label: "Metrics" },
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

  const isActive = (t: Tab) => (t.exact ? pathname === t.href : pathname.startsWith(t.href));
  const moreActive = more.some(isActive);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    position: "relative", flexShrink: 0, padding: "0.6rem 0.75rem", fontSize: "0.82rem",
    whiteSpace: "nowrap", textDecoration: "none", fontWeight: active ? 600 : 500,
    color: active ? (onDark ? "#fbbf24" : "#b45309") : fg3,
  });
  // R5: shared-layout indicator — only the active tab renders it; the shared layoutId makes
  // Motion slide it between tabs on navigation (the WorkspaceChrome persists across tab
  // switches). Reduced motion → a plain span that jumps instantly (no slide).
  const ulStyle: React.CSSProperties = { position: "absolute", insetInline: 8, bottom: 0, height: 2, borderRadius: 999, background: "linear-gradient(90deg,#b45309,#f59e0b)" };
  const underline = reduced ? (
    <span style={ulStyle} />
  ) : (
    <m.span layoutId="ws-tab-underline" transition={spring.snappy} style={ulStyle} />
  );

  return (
    <FluentScope>
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <AmbientField mode={mode} />
      </div>
      <div style={{ position: "relative", zIndex: 1, paddingInline: "var(--rd-page-px)", paddingBlock: "clamp(1rem,3vw,1.75rem)", maxWidth: maxW, marginInline: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* client identity header (glass) */}
        <div className={`rd-glass rd-glass--strong ${onDark ? "rd-glass--dark" : ""} rd-glass--ember`} style={{ borderRadius: 20, padding: "1.1rem 1.3rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.85rem" }}>
          <Avatar name={client.name} image={client.logo_url ? { src: client.logo_url } : undefined} color="brand" shape="square" size={48} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <h1 className="rd-display" style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: fg1 }}>{client.name}</h1>
              <StatusPill value={isProject ? "Project" : labelOf(PROGRAMS, client.program)} label={isProject ? "Project" : labelOf(PROGRAMS, client.program)} mode={mode} />
              <StatusPill value={client.status} mode={mode} />
            </div>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: fg3 }}>
              {client.start_date ? `Client since ${formatMonthYear(client.start_date)}` : ""}
              {dayLabel ? `${client.start_date ? " · " : ""}${dayLabel}` : ""}
            </p>
          </div>
          {isAdmin && (
            <Link href={`${base}/settings`} aria-label="Client settings" title="Client settings" className="rd-focus" style={{ marginLeft: "auto", display: "inline-flex", width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, border: `1px solid ${onDark ? "#37322a" : "#d6d3cd"}`, color: fg3 }}>
              <Settings size={16} />
            </Link>
          )}
        </div>

        {/* tabs */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2, overflowX: "auto", borderBottom: `1px solid ${onDark ? "#34302a" : "#e7e5e0"}` }}>
          {primary.map((t) => {
            const active = isActive(t);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className="rd-focus" style={tabStyle(active)}>
                {t.label}
                {active && underline}
              </Link>
            );
          })}
          <Menu positioning="below-end">
            <MenuTrigger disableButtonEnhancement>
              <button type="button" className="rd-focus" style={{ ...tabStyle(moreActive), background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                More <ChevronDown size={14} />{moreActive && underline}
              </button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {more.map((t) => (
                  <MenuItemLinkR key={t.href} href={t.href} active={isActive(t)}>{t.label}</MenuItemLinkR>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        </nav>

        <div>{children}</div>
      </div>
    </FluentScope>
  );
}

function MenuItemLinkR({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <MenuItem onClick={() => router.push(href)} style={active ? { fontWeight: 600 } : undefined}>
      {children}
    </MenuItem>
  );
}
