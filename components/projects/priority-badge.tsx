import { labelOf, PROJECT_PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Priority = (typeof PROJECT_PRIORITIES)[number]["value"];

// An escalating dot scale on a calm neutral chip — conveys priority without
// shouting (every project has one, so the chrome stays quiet; the dot carries it).
const DOT: Record<Priority, string> = {
  low: "bg-stone-400",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

/** Project priority chip (low · medium · high · urgent). */
export function PriorityBadge({
  value,
  className,
}: {
  value: Priority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-2",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[value])} />
      {labelOf(PROJECT_PRIORITIES, value)}
    </span>
  );
}
