import { cn } from "@/lib/utils";

// The metric numeral treatment (D1 §02/§05): Bricolage display, tabular figures,
// bold, tight tracking + leading. Size by role so a key metric is the dominant
// element of its card. The month-by-month TABLE keeps Inter tabular figures (true
// column alignment) — this is for card/snapshot numerals, where each card shows one
// number so display character wins over column alignment.
const SIZES = {
  hero: "text-[48px]", // client dashboard KPI band
  card: "text-[44px]", // a standalone secondary metric card
  snapshot: "text-[30px]", // a dense multi-metric snapshot cell
} as const;

export function MetricValue({
  children,
  size = "card",
  className,
}: {
  children: React.ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-display leading-none font-bold tracking-[-0.01em] text-ink tabular-nums",
        SIZES[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
