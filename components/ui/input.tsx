import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink shadow-e1 outline-none transition-all",
        "placeholder:text-ink-3 selection:bg-amber-200 selection:text-ink",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-[invalid=true]:border-danger-solid aria-[invalid=true]:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
