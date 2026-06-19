# Redesign R4 — Auth Hero + Special Surfaces (report)

Branch `redesign/r4-auth` (from the R3 tip). Reconciles the 3D auth hero + the auth
surfaces onto the Fluent v9 + Warm Obsidian system, and re-skins the remaining special
surfaces. **Presentation only** — auth logic, routing, redirects, validation, the
set-password/reset flows, RLS, RPCs are untouched. `main` stays shippable.

## What changed
- **`AuthFrame`** rebuilt as the finalized R0 keystone: a single frosted ember-glass card
  (`GlassSurface dark strong ember`, pure `rd-glass` CSS — no FluentProvider) floating over
  the reused, capability-gated 3D hero, with an obsidian scrim reading the warm hero as
  "night", entering on the phase-3 Motion spring (`AuthCardReveal`). Real logo. Form
  CONTROLS render SOLID inside (re-skinned `authInputClass`/`AuthInput`/`PasswordInput`/
  `AuthLabel`/`AuthError` on the Warm Obsidian palette).
- Applied to **login**, **welcome (create password)**, **reset (set new password)**, and
  the **reset-link request** — each keeps its DISTINCT copy/headings (pages unchanged but
  for one muted-text color fix). The hero, the gate (`canUse3D` + `useReducedMotion`), and
  the lazy `ssr:false` boundary are the existing, untouched islands.
- Special surfaces: **confirm interstitial** re-skinned automatically via `AuthFrame`;
  **404/not-found** + **error.tsx** re-skinned to ember-glass-light (warm ambient + amber);
  **global-error** kept (inline, stack-safe, root-replacing — correct as-is); **loading**
  kept (neutral skeleton).

## BUNDLE-ISOLATION PROOF — `scripts/redesign-r4-bundle-proof.mjs` ✅ PASS
Two independent methods on the production (Turbopack) build:
- **Static (chunk scan + shared baseline):**
  - three.js / R3F lives in **exactly 1 async chunk** (`37zd2c6dtc2v-.js`).
  - three is **NOT** in the shared baseline (`build-manifest.json → rootMainFiles`).
  - cal.com embed lives in **1 async chunk** (`3036k7eosb2tl.js`), also **not** in the baseline.
- **Runtime (served HTML — what the browser downloads initially):** `/login`,
  `/forgot-password`, `/accept-invite`, `/` each reference **three: 0, cal: 0** chunks.
  → the data app ships ZERO three.js / cal; both load only as runtime dynamic chunks.
- `transpilePackages: ["three"]` still affects only the lazy hero chunk. The Fluent
  re-platform did **not** pull three into the main bundle or break `ssr:false`.

## VERIFY — `scripts/redesign-r4-auth-verify.mjs` (9/9 checks, AA 28/0) + live capture
- **ssr:false / console clean:** `/login` loads with **no** "window is not defined" /
  hydration / text-mismatch errors. Auth logic, routing, and copy unchanged.
- **AA on the card over the backdrop:** 28 worst-case ring-sampled samples, **0 fail**
  (light + the bright static composition is the worst case; the card's strong-fill scrim +
  obsidian scrim keep all text ≥ AA). Fixed two `text-ink-3` (light muted) → `#b3aca0`
  (Warm Obsidian dark muted) leaks on the dark card.
- **Static fallback fires on ALL THREE triggers (no `<canvas>`):** mobile (coarse pointer,
  iPhone 13 descriptor), reduced-motion (`reducedMotion: reduce`), no-WebGL (`getContext('webgl*')`
  → null). Each captured.
- **Live 3D (headed GPU session):** canvas mounts, **~61 fps** (smooth) measured rAF
  cadence. DPR capped `[1,1.5]` + `PerformanceMonitor` downscale (in `scene.tsx`); the
  rAF loop is set to `frameloop="never"` on tab-hidden; context-loss degrades permanently to
  static (all in `backdrop-3d.tsx`, unchanged).
- **Reduced-transparency → solid card:** the `@media (prefers-reduced-transparency: reduce)`
  → opaque-solid `rd-glass` fallback in `app/(redesign)/redesign.css` is unchanged from
  R0–R3 and applies to the auth card (Playwright can't emulate this media query; the CSS
  rule is present + the glass downgrade is the same proven recipe).

## Screenshots (docs/redesign/r4/)
- `r4-hero-live-desktop.png` — **the strongest capture**: live drifting charcoal-icosahedra
  field + amber glints behind the obsidian-scrimmed ember-glass card.
- `r4-login-desktop.png`, `r4-welcome.png`, `r4-reset-setpw.png`, `r4-reset-request.png` —
  all four auth screens on the glass card.
- `r4-fallback-mobile.png`, `r4-fallback-reduced-motion.png`, `r4-fallback-no-webgl.png` —
  the static fallback on each trigger.
- `r4-confirm-interstitial.png`, `r4-not-found.png` — re-skinned special surfaces.

## Build
`next build` green; type-check clean (build type-checks); console clean; `main` untouched.

## Next
**R5 — the motion pass.** (R4 stops here.)
