"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * On-token switch (shadcn/Radix). Was visually invisible (over-engineered class soup
 * + a sub-20px track with a transparent fallback); rebuilt to the standard shadcn
 * structure: a clearly-visible track (amber when on, border-strong when off), a white
 * thumb with a drop shadow, and an amber focus ring. `size` is preserved for callers.
 * Travel is 14px for both sizes (default w-8/thumb-16; sm w-7/thumb-12 → both = 14px).
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-inner transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-amber-600/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-amber-600 data-[state=unchecked]:bg-border-strong",
        "data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-4 data-[size=sm]:w-7",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform",
          "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-3.5",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
