# Motion system (Phase 3)

The portal's motion layer. **Source of truth = [`lib/motion.ts`](../../lib/motion.ts)** — every
duration, spring, and variant lives there; nothing animates with magic numbers at the call site.

## Character

**Confident, but fast.** Springs are *snappy* — high stiffness, moderate damping — so feedback
lands the instant you act, never lingering. Motion is a layer of polish, not a wait. One restrained
*bouncy* preset (mild overshoot) is reserved for a single special-success moment (deliverable
approval); everything else is snappy or a short tween.

## Tokens

| Token | Value | Use |
|---|---|---|
| `spring.snappy` | stiffness 520 · damping 34 · mass 0.8 | Default. Buttons, cards, tabs, entrances. |
| `spring.smooth` | stiffness 300 · damping 34 · mass 1 | Heavier/larger elements that would feel twitchy at snappy speed. |
| `spring.bouncy` | stiffness 460 · damping 17 · mass 0.9 | **Reserved** — special success only (deliverable approve check). Used once. |
| `duration.fast` | 0.14s | Micro-feedback. |
| `duration.base` | 0.22s | Route crossfade. |
| `duration.slow` | 0.34s | — |
| `duration.count` | 0.7s | KPI count-up. |
| `ease.out` | `[0.16, 1, 0.3, 1]` | Tweens (route, count-up). |
| `stagger.children` | 0.05s | Per-item delay in a list/grid entrance. |

Shared variants: `fadeInUp` (opacity + 8px rise), `scaleIn` (opacity + 0.96→1), `staggerContainer`.

## Architecture

- **App-root provider** ([`components/motion/motion-provider.tsx`](../../components/motion/motion-provider.tsx)):
  `LazyMotion features={domMax} strict` loads the DOM feature set (animation + gestures + layout) **once**,
  and `strict` errors on an accidental full-bundle `motion.*` import — every animated component uses the
  lightweight `m.*`.
- **Reduced motion is central** (see below).
- **Primitives** ([`components/motion/motion-primitives.tsx`](../../components/motion/motion-primitives.tsx)):
  `<Stagger>` / `<StaggerItem>` (grid & list entrances, optional `lift` for clickable cards) and `<FadeIn>`.
- **Route transition** ([`components/motion/route-transition.tsx`](../../components/motion/route-transition.tsx)).

## Page transitions — Motion crossfade (not native View Transitions)

The **native View Transitions API path was verified and rejected** for this stack:

- Next 16.2.9's `experimental.viewTransition` delegates to React's `ViewTransition` component, but
  **React 19.2.4 stable does not export `ViewTransition`/`unstable_ViewTransition`** (only
  `startTransition`/`useTransition`), and Next does not call `document.startViewTransition`.

So the native API is **not cleanly available**. Page transitions use a **minimal Motion crossfade**
(`opacity` + 6px rise, `duration.base`), keyed on the **top-level path segment** so switching workspace
tabs within `/clients/[id]/*` does **not** re-trigger it. Applied in both shells (staff + client).

## Reduced motion — `prefers-reduced-motion: reduce`

Built **centrally**, three layers, all degrading to instant final states:

1. **`MotionConfig reducedMotion="user"`** (provider) — disables transform/layout animations globally.
2. **Component guards** — `RouteTransition`, the `Stagger`/`FadeIn` primitives, and the `MetricValue`
   count-up each call `useReducedMotion()` and render the plain final element (no fade, no stagger,
   number jumps straight to its final value).
3. **`globals.css` media block** — neutralizes CSS animations/transitions and the Radix `tw-animate-css`
   dialog enter/exit.

**Verified** — see [`phase-3-reduced-motion/`](phase-3-reduced-motion/): under reduce, the dashboard renders
all KPIs at final value (140 / 192 / 295 / 244) at 0 ms with every card already in place, while the motion
capture ([`phase-3-motion/`](phase-3-motion/)) shows the same band mid-count ("93") with cards staggering in.

## Surfaces animated

Buttons (press scale 0.97 + hover lift, wired into `button.tsx` by hand) · interactive cards (KPI /
client / deliverable / task hover-lift) · tabs (client pill-nav + workspace underline, shared-element
`layoutId` slide) · KPI numerals (count-up in `<MetricValue>`, tabular figures) · dashboard / deliverables /
tasks grids (staggered spring entrance) · dialogs (Radix scale+fade, reduced-motion gated) · deliverable
approval (the lone `bouncy` success pop) · checklist accordion (existing CSS grid-rows collapse, already
reduced-motion gated).

## Performance

Transform/opacity only. Count-up renders a `MotionValue` straight to the DOM (no per-frame React
re-render). `m.*` everywhere (no full `motion.*` bundle). `layoutId` is the only layout animation.
