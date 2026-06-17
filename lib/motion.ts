import type { Transition, Variants } from "motion/react";

/**
 * Central motion config — the single source of truth for the portal's motion.
 * Character: confident but FAST. Springs are SNAPPY (high stiffness, moderate damping)
 * — responsive and alive, never floaty/slow. `bouncy` (mild overshoot) is reserved for
 * special success moments (e.g. a deliverable approval) and used sparingly.
 *
 * Reduced motion is handled centrally — see components/motion/motion-provider.tsx
 * (MotionConfig reducedMotion="user") + the shared wrappers/hooks that check
 * useReducedMotion. No magic numbers live outside this file.
 */
export const spring = {
  /** default micro-interactions (press, hover, indicator, card lift) */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
  /** larger surfaces that shouldn't feel twitchy (modals, sheets) */
  smooth: { type: "spring", stiffness: 300, damping: 34, mass: 1 },
  /** SPARING — special success only (mild overshoot) */
  bouncy: { type: "spring", stiffness: 460, damping: 17, mass: 0.9 },
} satisfies Record<string, Transition>;

/** Tween durations (seconds) for the non-spring cases (fades, count-up). */
export const duration = { fast: 0.14, base: 0.22, slow: 0.34, count: 0.7 } as const;

/** Named eases for tweens. */
export const ease = {
  out: [0.16, 1, 0.3, 1],
  standard: [0.2, 0, 0, 1],
} as const;

/** Stagger cadence for list/grid entrances. */
export const stagger = { children: 0.05, delay: 0.03 } as const;

// ---- shared variants (entrance) ----
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring.snappy },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: spring.snappy },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: stagger.children, delayChildren: stagger.delay } },
};

export { useReducedMotion } from "motion/react";
