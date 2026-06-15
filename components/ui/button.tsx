import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // charcoal — the workhorse primary
        default: "bg-ink text-white hover:bg-charcoal-hover",
        // amber CTA — depth gradient over amber-700 base (white text = AA), hover amber-800
        amber:
          "bg-amber-700 bg-[image:var(--amber-cta)] text-white shadow-[var(--shadow-amber)] hover:bg-amber-800 hover:bg-[image:var(--amber-cta-hover)]",
        outline:
          "border border-border-strong bg-surface text-ink hover:border-ink hover:bg-bg",
        secondary: "bg-surface-2 text-ink hover:bg-border",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        destructive: "bg-danger-solid text-white hover:bg-danger-hover",
        link: "h-auto rounded-none px-0 text-amber-700 underline-offset-[3px] hover:underline",
      },
      size: {
        default: "h-11 px-[22px]",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-11 rounded-full p-0",
        "icon-sm": "size-9 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  // asChild: Slot requires exactly ONE child, so pass children straight through
  // (no spinner injection, and `disabled` doesn't apply to e.g. an <a>).
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
