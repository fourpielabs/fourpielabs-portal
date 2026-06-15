import { cn } from "@/lib/utils";

/**
 * Brand wordmark — the single source of truth for the 4Pie Labs mark.
 * Renders the text wordmark today; when the real logo asset lands, swap the
 * inner markup here once and every render site updates. Callers own their own
 * sizing (via `className`) and any <Link>/onClick wrapper.
 *
 * `dark` switches the trailing accent dot to amber-400 for dark surfaces.
 */
export function BrandLogo({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span className={cn("font-display font-bold tracking-tight", className)}>
      4Pie Labs
      <span className={dark ? "text-amber-400" : "text-amber-600"}>.</span>
    </span>
  );
}
