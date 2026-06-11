import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink shadow-e1 transition-all outline-none placeholder:text-ink-3 disabled:pointer-events-none disabled:opacity-50 aria-[invalid=true]:border-danger-solid aria-[invalid=true]:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
