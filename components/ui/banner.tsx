import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const bannerVariants = cva(
  "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
  {
    variants: {
      tone: {
        amber: "border-amber-200 bg-amber-50 text-amber-900",
        info: "border-info-border bg-info-bg text-info-text",
        success: "border-success-border bg-success-bg text-success-text",
        danger: "border-danger-border bg-danger-bg text-danger-text",
        neutral: "border-border bg-surface-2 text-ink-2",
      },
    },
    defaultVariants: { tone: "amber" },
  },
);

function Banner({
  className,
  tone,
  icon,
  action,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof bannerVariants> & {
    icon?: React.ReactNode;
    action?: React.ReactNode;
  }) {
  return (
    <div className={cn(bannerVariants({ tone }), className)} {...props}>
      {icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Banner, bannerVariants };
