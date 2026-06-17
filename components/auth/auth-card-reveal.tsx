"use client";

import { m } from "motion/react";

import { useReducedMotion, scaleIn } from "@/lib/motion";

/**
 * Card entrance for the auth shell — settles in on the phase-3 `snappy` spring
 * (scale + fade). Reduced-motion renders the final state instantly (no transform),
 * via the centralized hook.
 */
export function AuthCardReveal({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <m.div className={className} variants={scaleIn} initial="hidden" animate="show">
      {children}
    </m.div>
  );
}
