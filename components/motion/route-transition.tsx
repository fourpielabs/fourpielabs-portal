"use client";

import { usePathname } from "next/navigation";
import { m } from "motion/react";

import { useReducedMotion, duration, ease } from "@/lib/motion";

/**
 * Subtle page transition for TOP-LEVEL section changes only — keyed on the first path
 * segment, so switching workspace tabs within /clients/[id]/* does NOT re-trigger it
 * (tabs get the animated indicator in Step 3). Gentle fade + small slide IN, fast.
 *
 * Path chosen: Motion fallback (not the native View Transitions API). React 19.2.4
 * (stable) does not export the `ViewTransition` component that Next 16.2.9's
 * `experimental.viewTransition` relies on, and Next doesn't fall back to native
 * `document.startViewTransition`. So the native path isn't cleanly available here.
 *
 * Reduced motion → no transition at all (renders children directly).
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = pathname.split("/")[1] ?? "root";
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <m.div
      key={segment}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      {children}
    </m.div>
  );
}
