"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

/**
 * Shared redesign presentation helpers — thin wrappers over the glass + immersive
 * classes in app/(redesign)/redesign.css. Keeping these in one place is the
 * "spend boldness in ONE place, keep everything else quiet" discipline: the glass
 * recipe lives here and on the KPI/auth surfaces, nowhere else.
 *
 * (Moved from components/redesign/ui.tsx into the ui/ layer in R1; re-exported by
 * ui/index.ts so existing `@/components/redesign/ui` imports keep resolving.)
 */

/** Full-bleed, full-height immersive shell. */
export function Shell({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("rd-shell", className)} style={style}>
      {children}
    </div>
  );
}

/** Ambient warm field that sits behind the shell content (full-bleed background). */
export function AmbientField({ mode }: { mode: "light" | "dark" }) {
  return (
    <div
      aria-hidden
      className={mode === "dark" ? "rd-field-dark" : "rd-field-light"}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    />
  );
}

/** Readable measure inside the immersive shell (content never goes full-bleed). */
export function Measure({
  width = "standard",
  className,
  children,
  style,
}: {
  width?: "text" | "standard" | "wide";
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("rd-measure", `rd-measure--${width}`, className)} style={style}>
      {children}
    </div>
  );
}

/** The mono "instrument label" eyebrow — the type signature of the system. */
export function Eyebrow({
  children,
  tone = "amber",
  className,
  style,
}: {
  children: React.ReactNode;
  tone?: "amber" | "muted" | "onDark";
  className?: string;
  style?: React.CSSProperties;
}) {
  const { mode } = useRedesignMode();
  // "muted" must be mode-aware (a dark grey fails AA on the obsidian field);
  // amber/onDark are picked by the call site per surface.
  const color =
    tone === "amber"
      ? "#b45309"
      : tone === "onDark"
        ? "#fbbf24"
        : mode === "dark"
          ? "#b3aca0"
          : "#63605a";
  return (
    <span className={cn("rd-eyebrow", className)} style={{ color, ...style }}>
      {children}
    </span>
  );
}

/**
 * Glass pane. `dark` chooses the ember-obsidian recipe; `strong` raises the fill
 * to the scrim level (for KPI/summary surfaces carrying text); `ember` adds the
 * signature bloom. All three downgrade to an opaque solid under reduced-transparency
 * / reduced-motion (handled in CSS — nothing to wire here).
 */
export function GlassSurface({
  dark = false,
  strong = false,
  ember = false,
  className,
  style,
  children,
}: {
  dark?: boolean;
  strong?: boolean;
  ember?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rd-glass",
        dark && "rd-glass--dark",
        strong && "rd-glass--strong",
        ember && "rd-glass--ember",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
