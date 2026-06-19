# Redesign R5 — Motion Pass (report)

Branch `redesign/r5-motion` (from the R4 tip). Adds the connective motion layer across the
fully-converted app on the existing Motion v12 setup + R0 motion tokens. **Presentation
only** — server actions/queries/RLS/RPCs/the four invariants untouched. No second animation
engine; no new design/glass tokens. `main` untouched.

## What was already there (reused, not rebuilt)
The motion system shipped during R0–R4 and is reused verbatim: `lib/motion.ts` (snappy /
smooth / bouncy springs, durations, `fadeInUp`/`scaleIn`/`staggerContainer`), `MotionProvider`
(`LazyMotion domMax strict` + `MotionConfig reducedMotion="user"`), the `Stagger`/`StaggerItem`/
`FadeIn` primitives, `RouteTransition` (keyed on the first path segment), the CSS entrance/hover
layer (`.rd-rise`/`.rd-pop`/`.rd-lift`, reduced-motion-safe by construction), and the
`MetricValue` count-up. The **client** shell already wired `RouteTransition`; client R2 bodies
already carry `rd-rise` entrances; the count-up already runs on the client KPI band.

## What R5 added / reconciled
1. **Route transitions on BOTH shells.** Wired `RouteTransition` into the **StaffShell**
   `<main>` (it was the one shell still rendering children raw). Approach: Motion crossfade
   (`opacity + 6px y`, `duration.base`/`ease.out`) keyed on `pathname.split("/")[1]` — the
   **tab-switch nuance**: workspace tabs within `/clients/[id]/*` all share the `clients`
   segment, so switching tabs does NOT re-fire the page transition (the per-client tabs get
   the shared-layout indicator instead). Scoped to `<main>` so the sticky glass chrome
   (sidebar/header) is OUTSIDE the animated subtree — the route fade never re-composites a
   backdrop-filter surface. Off entirely under reduced motion.
2. **Shared-layout tab indicator.** The WorkspaceChrome tab underline became a Motion
   `layoutId="ws-tab-underline"` span (snappy spring) that SLIDES between tabs on navigation
   (the chrome persists across tab switches). Reduced motion → a plain span that jumps.
3. **Entrance choreography on staff surfaces.** Added a `.rd-stagger` CSS utility (reuses the
   `rd-rise` keyframe with a capped nth-child cadence, reduced-motion-safe) and applied it to
   the staff **Overview** grid, **Deliverables** list, and **Tasks** board — the R3 staff
   surfaces that lacked the per-item entrance the R2 client bodies already carry.
4. **Reconciled micro-interactions.** Card hover (`.rd-lift`), the metric count-up
   (`MetricValue`), the checklist accordion (grid-rows transition), and Fluent button/dialog
   motion are all retained + coherent — distinct elements from RouteTransition/rd-stagger/
   layoutId, so nothing double-animates. The bouncy spring stays reserved (success only).

## REDUCED-MOTION PROOF — `scripts/redesign-r5-motion-verify.mjs` ✅ (client + staff)
Final-state-at-0ms captures + assertions under `prefers-reduced-motion: reduce`:
- **entrances instant** — `rd-rise`/`rd-stagger` `animation-duration` = `1e-06s` (vs `0.22s`
  normally); content at **opacity 1, visible** at ~0ms (no transform).
- **route transitions off** — `RouteTransition` returns children raw under reduced motion.
- **glass → solid, bloom static** — the glass `background-color` is **opaque (alpha 1)** under
  reduced motion (vs `0.9` translucent normally) and the ember `::before` bloom is
  `display:none`. Captures: `r5-reduced-client-dashboard-0ms.png`, `r5-reduced-staff-overview-0ms.png`.
- **reduced-transparency** → same opaque-solid + bloom-off path (a sibling `@media` block).
- **Bug found + fixed:** Lightning CSS (Next's minifier) dropped the standard
  `backdrop-filter: none` from the reduced `@media` blocks as "initial-value-redundant" (keeping
  only `-webkit-`), so the base blur survived. Fixed centrally in **globals.css** (the single,
  provably-applied reduced block) with `blur(0px)` + the **opaque background-color fallback** —
  the latter is the real "solid card" guarantee (an opaque bg makes any residual blur invisible).

## Route-transition + interaction verification
- ✅ FIRES on top-level section change (`/dashboard → /clients`: wrapper opacity dips to 0.00).
- ✅ does NOT re-fire on a workspace tab switch (`/clients/[id]/checklist → …/metrics`: wrapper
  opacity stays 1.00).
- ✅ tab indicator slides — captured under **Checklist** then **Metrics** (`r5-tab-indicator-*.png`).
- ✅ count-up preserved (MetricValue, reduced → instant). AA unaffected — motion animates only
  transform/opacity/bg-opacity; the reduced solid glass only *increases* contrast, so the R2–R4
  AA results stand for both client types + staff.

## Performance / hotspots
- **transform/opacity only** (compositor-friendly): RouteTransition (opacity+y), rd-rise/rd-pop
  (opacity+transform), layoutId (transform), rd-lift (transform). No layout-property animation.
- **fps:** ~**62 fps** on a headed GPU during a route transition over the glass shell
  (headless software compositing reports ~36–50 — an artifact, not representative).
- **glass+motion overlap:** the route transition is scoped to `<main>`, EXCLUDING the sticky
  glass chrome — so we never animate a subtree that's also a `backdrop-filter` surface (the
  expensive case). Staff entrances animate SOLID cards (`rd-solid`, no backdrop-filter). The one
  inherent cost — `backdrop-filter` repaint while scrolling under the glass header — predates R5
  and is unchanged; no animation runs concurrently on the same glass element.

## Strongest captures (docs/redesign/r5/)
- `r5-tab-indicator-checklist.png` + `r5-tab-indicator-metrics.png` — the shared-layout indicator under two tabs.
- `r5-reduced-staff-overview-0ms.png` + `r5-reduced-client-dashboard-0ms.png` — the reduced-motion 0ms proof (solid glass, final state).
- `r5-grid-entrance-midframe.png` — the staff overview mid-stagger.

## Next
**R6 — parity + cutover (the last phase).**
