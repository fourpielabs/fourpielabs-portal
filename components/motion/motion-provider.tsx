"use client";

import { LazyMotion, domMax, MotionConfig } from "motion/react";

/**
 * App-root motion provider (in app/layout.tsx, wrapping everything).
 *
 * - LazyMotion(domMax): loads the DOM feature set (animations + gestures + layout
 *   animations, needed for layoutId tab indicators) ONCE, lazily — so feature code is
 *   shared, not bundled per component. We use the lightweight `m` components everywhere;
 *   `strict` makes an accidental full `motion.*` import throw (keeps the bundle honest).
 * - MotionConfig reducedMotion="user": the CENTRAL reduced-motion switch — under
 *   prefers-reduced-motion every Motion component drops transform/layout animation
 *   automatically. Entrance, count-up and route transitions additionally check
 *   useReducedMotion in their own wrappers so they go fully instant (no fade either).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
