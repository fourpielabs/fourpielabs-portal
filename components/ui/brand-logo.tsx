import { cn } from "@/lib/utils";

/**
 * Brand logo — the single source of truth for the 4Pie Labs mark. Renders the real
 * wordmark asset (`public/logo.webp`, a charcoal logotype on transparent). Sizing is
 * em-based so it scales with each caller's existing font-size class (`text-lg`,
 * `text-[19px]`, …), preserving their prior optical size with no call-site changes.
 *
 * `dark` = on a DARK surface (auth card, staff rail) → the monochrome mark is recolored
 * to white via a CSS filter — the LIGHT treatment derived from the single asset, no extra
 * file. Default = the charcoal mark on a light/cream surface (nav, landing).
 */
export function BrandLogo({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset; em-based height (scales with the caller's font-size) is cleaner than next/image's fixed intrinsic sizing
    <img
      src="/logo.webp"
      alt="4Pie Labs"
      style={{ height: "1.25em", width: "auto" }}
      className={cn(
        "inline-block max-w-none select-none align-middle",
        dark && "[filter:brightness(0)_invert(1)]",
        className,
      )}
    />
  );
}
