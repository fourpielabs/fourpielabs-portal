"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar, tokens } from "@fluentui/react-components";
import { GlassSurface, Measure } from "@/components/redesign/ui";
import { BrandLogo } from "@/components/ui/brand-logo";

const NAV = [
  { label: "Dashboard", href: "/redesign-preview/dashboard" },
  { label: "Performance", href: "/redesign-preview/performance" },
  { label: "Deliverables", href: "#" },
  { label: "Documents", href: "#" },
];

/**
 * Shared glass chrome bar for the data keystones (glass is allowed on nav/chrome).
 * Sticky, full-bleed, with the nav measured to the readable `wide` column inside.
 */
export function PreviewChrome({
  active,
  onDark,
  avatarName,
  avatarSrc,
  rightSlot,
}: {
  active: string;
  onDark: boolean;
  avatarName: string;
  avatarSrc?: string | null;
  rightSlot?: React.ReactNode;
}) {
  return (
    <GlassSurface
      dark={onDark}
      className="rd-chrome"
      style={{ position: "sticky", top: 0, zIndex: 30, borderRadius: 0, borderInline: "none", borderTop: "none" }}
    >
      <Measure width="wide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", minWidth: 0 }}>
          <Link href="/redesign-preview" style={{ fontSize: "1.15rem", display: "inline-flex" }} aria-label="Redesign keystones">
            <BrandLogo dark={onDark} />
          </Link>
          <nav className="rd-nav" style={{ display: "flex", gap: "1.25rem" }}>
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="rd-eyebrow"
                style={{
                  color: n.label === active ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3,
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          {rightSlot}
          <Avatar name={avatarName} color="brand" size={32} image={avatarSrc ? { src: avatarSrc } : undefined} />
        </div>
      </Measure>
    </GlassSurface>
  );
}

/** The amber "Live" pill used in chrome. */
export function LivePill({ label, onDark }: { label: string; onDark: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "0.35rem 0.7rem",
        borderRadius: 999,
        color: onDark ? "#fcd34d" : "#92400e",
        background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7",
        border: `1px solid ${onDark ? "rgba(245,158,11,0.3)" : "#fde68a"}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: "#d97706" }} />
      {label}
    </span>
  );
}
