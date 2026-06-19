"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

type Mode = "light" | "dark";

/** Humanize an enum value: "needs_review" → "Needs review". */
export function humanize(v: string): string {
  const s = v.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Tone = "success" | "amber" | "neutral" | "info" | "danger";

function toneOf(value: string): Tone {
  // normalize underscores → spaces so word boundaries work (so "inactive" never
  // matches "active", and "in_progress" matches "in progress").
  const v = value.toLowerCase().replace(/_/g, " ");
  if (/\b(done|approved|delivered|published|complete|completed|active|won|paid)\b/.test(v)) return "success";
  if (/\b(churned|failed|cancelled|canceled|rejected|overdue|error|lost)\b/.test(v)) return "danger";
  if (/\b(in progress|review|scheduled|pending|proposed|onboarding)\b/.test(v)) return "amber";
  if (/\b(upcoming|draft|todo|backlog|new|paused|inactive|on hold|not started|empty)\b/.test(v)) return "neutral";
  return "info";
}

const TONE_LIGHT: Record<Tone, { bg: string; fg: string; bd: string }> = {
  // all foregrounds verified ≥ 4.5:1 on their bg
  success: { bg: "#dcfce7", fg: "#166534", bd: "#bbf7d0" },
  amber: { bg: "#fef3c7", fg: "#92400e", bd: "#fde68a" },
  neutral: { bg: "#f1efe8", fg: "#57534e", bd: "#e2dfd8" },
  info: { bg: "#dbeafe", fg: "#1d4ed8", bd: "#bfdbfe" },
  danger: { bg: "#fee2e2", fg: "#991b1b", bd: "#fecaca" },
};
const TONE_DARK: Record<Tone, { bg: string; fg: string; bd: string }> = {
  success: { bg: "rgba(34,197,94,0.16)", fg: "#86efac", bd: "rgba(34,197,94,0.32)" },
  amber: { bg: "rgba(245,158,11,0.16)", fg: "#fcd34d", bd: "rgba(245,158,11,0.34)" },
  neutral: { bg: "rgba(255,255,255,0.08)", fg: "#cdc6ba", bd: "rgba(255,255,255,0.16)" },
  info: { bg: "rgba(96,165,250,0.16)", fg: "#bfdbfe", bd: "rgba(96,165,250,0.34)" },
  danger: { bg: "rgba(239,68,68,0.16)", fg: "#fca5a5", bd: "rgba(239,68,68,0.34)" },
};

/** Small, mode-aware status pill (AA in both modes). */
export function StatusPill({
  value,
  label,
  mode,
}: {
  value: string;
  label?: string;
  mode: Mode;
}) {
  const t = (mode === "dark" ? TONE_DARK : TONE_LIGHT)[toneOf(value)];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: "0.72rem",
        fontWeight: 600,
        lineHeight: 1,
        padding: "0.3rem 0.6rem",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        whiteSpace: "nowrap",
      }}
    >
      {label ?? humanize(value)}
    </span>
  );
}

/**
 * Delta chip — direction by GLYPH (▲/▼) AND color (never color alone, so it's
 * colorblind-safe), AA in both modes. No render for a null/zero delta.
 */
export function DeltaChip({
  delta,
  mode,
  suffix = "",
}: {
  delta: number | null | undefined;
  mode: Mode;
  suffix?: string;
}) {
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  const palette = mode === "dark"
    ? { up: "#86efac", upBg: "rgba(34,197,94,0.16)", down: "#fca5a5", downBg: "rgba(239,68,68,0.16)" }
    : { up: "#166534", upBg: "#dcfce7", down: "#b23a1e", downBg: "#fbeae3" };
  const fg = up ? palette.up : palette.down;
  const bg = up ? palette.upBg : palette.downBg;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: "0.74rem",
        fontWeight: 700,
        padding: "0.2rem 0.45rem",
        borderRadius: 999,
        color: fg,
        background: bg,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {up ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
      {Math.abs(delta).toLocaleString()}
      {suffix}
    </span>
  );
}

/** Thin progress meter (amber fill). */
export function Progress({ pct, mode }: { pct: number; mode: Mode }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        overflow: "hidden",
        background: mode === "dark" ? "rgba(255,255,255,0.1)" : "#ece9e2",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          borderRadius: 999,
          background: "linear-gradient(90deg, #b45309, #f59e0b)",
        }}
      />
    </div>
  );
}
