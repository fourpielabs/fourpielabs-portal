import { cn } from "@/lib/utils";

/**
 * One page-header scale for the whole portal, sized by the inherited density
 * (spacious on client, compact on staff/admin via the `--page-title` token).
 * Eyebrow + title + optional description on the left; `actions` right-aligned on
 * desktop and wrapping below the title on mobile.
 *
 * Designed to be the first child of a `<PageContainer stack>` — vertical rhythm to
 * the content below comes from the container's `--section-gap`, so PageHeader adds
 * no margin of its own.
 *
 * Intentional exception: hero treatments (the client dashboard greeting, the
 * performance page) sit ABOVE/INSTEAD of this — do not force them through PageHeader.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold tracking-[0.08em] text-ink-3 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[length:var(--page-title)] leading-[1.15] font-semibold tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[68ch] text-[14.5px] text-ink-2">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
