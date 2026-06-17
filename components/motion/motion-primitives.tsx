"use client";

import { m } from "motion/react";

import { useReducedMotion, staggerContainer, fadeInUp, spring } from "@/lib/motion";

// Reduced motion is handled HERE (centrally): when the user prefers reduced motion these
// render plain elements at their final state — no transform, no opacity transition, instant.
const M = { div: m.div, ul: m.ul, li: m.li, section: m.section } as const;
type El = keyof typeof M;

/** Stagger container — children animate in one after another on mount (once). */
export function Stagger({ as = "div", className, children }: { as?: El; className?: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) {
    const P = as;
    return <P className={className}>{children}</P>;
  }
  const C = M[as];
  return (
    <C className={className} variants={staggerContainer} initial="hidden" animate="show">
      {children}
    </C>
  );
}

/** A child of <Stagger> — fades + lifts in, orchestrated by the container's stagger.
 * `lift` adds a spring hover-elevation for interactive (clickable) cards. */
export function StaggerItem({
  as = "div",
  className,
  lift = false,
  children,
}: {
  as?: El;
  className?: string;
  lift?: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    const P = as;
    return <P className={className}>{children}</P>;
  }
  const C = M[as];
  return (
    <C
      className={className}
      variants={fadeInUp}
      whileHover={lift ? { y: -3 } : undefined}
      transition={spring.snappy}
    >
      {children}
    </C>
  );
}

/** A standalone fade-in-up element (not part of a stagger). */
export function FadeIn({ as = "div", className, children }: { as?: El; className?: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) {
    const P = as;
    return <P className={className}>{children}</P>;
  }
  const C = M[as];
  return (
    <C className={className} variants={fadeInUp} initial="hidden" animate="show">
      {children}
    </C>
  );
}
