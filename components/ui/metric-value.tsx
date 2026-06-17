"use client";

import { useEffect } from "react";
import { m, useMotionValue, useTransform, animate } from "motion/react";

import { useReducedMotion, duration, ease } from "@/lib/motion";
import { formatMetricValue } from "@/lib/format";
import { cn } from "@/lib/utils";

// The metric numeral treatment (D1 §02/§05): Bricolage display, tabular figures, bold,
// tight tracking/leading. Sized by role so a key metric is the dominant element of its card.
const SIZES = {
  hero: "text-[48px]", // client dashboard KPI band
  card: "text-[44px]", // a standalone secondary metric card
  snapshot: "text-[30px]", // a dense multi-metric snapshot cell
} as const;
const BASE = "font-display leading-none font-bold tracking-[-0.01em] text-ink tabular-nums";

/**
 * Metric numeral. Pass `value` (number) + `unit` to get a count-up to the value on mount
 * (Phase 3); otherwise renders the static `children`. Tabular figures keep digits aligned
 * during the count. Reduced motion → jumps straight to the final value (no count).
 */
export function MetricValue({
  children,
  value,
  unit,
  size = "card",
  className,
}: {
  children?: React.ReactNode;
  value?: number | null;
  unit?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const cls = cn(BASE, SIZES[size], className);
  if (typeof value === "number" && Number.isFinite(value) && unit && unit !== "text") {
    return <CountUp value={value} unit={unit} className={cls} />;
  }
  return <span className={cls}>{children}</span>;
}

function CountUp({ value, unit, className }: { value: number; unit: string; className: string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  // Motion renders this MotionValue<string> directly into the DOM — no per-frame React render.
  const text = useTransform(mv, (v) => formatMetricValue(unit, Math.round(v), null));
  useEffect(() => {
    if (reduced) {
      mv.set(value); // instant final value, no count
      return;
    }
    const controls = animate(mv, value, { duration: duration.count, ease: ease.out });
    return () => controls.stop();
  }, [value, reduced, mv]);
  return <m.span className={className}>{text}</m.span>;
}
