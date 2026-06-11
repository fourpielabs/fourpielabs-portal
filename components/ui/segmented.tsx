"use client";

import { cn } from "@/lib/utils";

/**
 * Charcoal segmented control (D2 selection controls): charcoal active pill on a
 * surface-2 track. Controlled. Use for binary/few-way view switches (e.g. the
 * content List | Month toggle).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  size = "default",
}: {
  options: { value: T; label: string }[];
  value: T;
  onValueChange: (v: T) => void;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full bg-surface-2 p-1",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "rounded-full font-semibold whitespace-nowrap transition-colors",
              size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
              active ? "bg-ink text-white" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
