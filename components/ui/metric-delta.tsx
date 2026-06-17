import { cn } from "@/lib/utils";

/**
 * Metric delta — arrow + magnitude in the warm-harmonized delta tokens. `badge` =
 * filled pill (hero KPI band); `inline` = text-only (tables, dense snapshots). Pair
 * a muted "vs {period}" context line next to it at the call site (D1 §05). Renders
 * nothing for a zero/absent delta. Colorblind-safe: glyph + color, never color alone.
 */
export function MetricDelta({
  delta,
  variant = "badge",
  className,
}: {
  delta: number | null | undefined;
  variant?: "badge" | "inline";
  className?: string;
}) {
  if (!delta) return null; // 0, null, undefined → no delta to show
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        variant === "badge"
          ? cn(
              "rounded-full px-2.5 py-[3px] text-[13px]",
              up ? "bg-delta-up-bg text-delta-up" : "bg-delta-down-bg text-delta-down",
            )
          : cn("text-[12px]", up ? "text-delta-up" : "text-delta-down"),
        className,
      )}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {Math.abs(delta).toLocaleString()}
    </span>
  );
}
