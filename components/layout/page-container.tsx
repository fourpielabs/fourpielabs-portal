import { cn } from "@/lib/utils";

const WIDTHS = {
  focused: "max-w-focused", // 720 — forms, reading, single-record
  standard: "max-w-standard", // 1200 — default
  wide: "max-w-wide", // 1440 — dense tables, boards
  full: "max-w-none",
} as const;

export type PageWidth = keyof typeof WIDTHS;

/**
 * The single owner of page content width, centering, responsive side-padding, and
 * density. It sits INSIDE the role shell (the shells no longer constrain width), so
 * `width="wide"` can exceed the old 1280 cap. Density inherits from the shell's
 * `data-density` (client=spacious, staff=compact) unless overridden via the prop.
 *
 * `stack` turns it into the page's vertical rhythm column (flex-col with the
 * density-aware `--section-gap`), so a `<PageHeader>` + sections separate cleanly
 * with no margin-collapsing. Omit `stack` for hero pages that own their own gaps.
 */
export function PageContainer({
  width = "standard",
  density,
  stack = false,
  className,
  children,
}: {
  width?: PageWidth;
  density?: "spacious" | "compact";
  stack?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-density={density}
      className={cn(
        "mx-auto w-full px-[var(--page-px)]",
        WIDTHS[width],
        stack && "flex flex-col gap-[var(--section-gap)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
