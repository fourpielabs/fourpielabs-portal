# Phase 4 — The Auth Hero (showpiece)

The one place 3D lives in the product: a calm, editorial field of small **charcoal**
forms drifting through **cream** light, with **amber** as the warm key/rim catching
their edges. Presentation only — no auth logic, routing, validation, or copy changed
(the three auth page files have **zero** diff vs `main`).

## Architecture (bundle isolation)

```
app/(auth)/layout.tsx → AuthFrame (server component)
  ├─ <AuthHero/>                  components/auth/hero/auth-hero.tsx — CLIENT island
  │     gate: useReducedMotion() (reused phase-3 hook) + canUse3D() (WebGL/touch/save-data)
  │     dynamic(() => import("./backdrop-3d"), { ssr:false })   ← the isolation boundary
  │       └─ backdrop-3d.tsx  Canvas + crossfade + visibility-pause + context-loss → static
  │            └─ scene.tsx   the ONLY three/R3F/drei importer (+ backdrop-3d's Canvas)
  │     static branch / loading / Suspense / post-loss → hero-static.tsx (pure CSS+SVG)
  └─ <AuthCardReveal/> frosted smoked-glass card (snappy scale-in, reduced-motion gated)
```

`ssr:false` is legal only inside the client island; the server `AuthFrame` reaches the
3D subtree **only** through the `dynamic()` edge, so three.js never enters the server/app
graph. `three`/`@react-three/*` is statically imported in exactly two files (`scene.tsx`,
`backdrop-3d.tsx`).

## Bundle proof (Next 16 dropped First-Load-JS from build output; analyzer is webpack-only)

Filesystem chunk check on `next build` (Turbopack):
- `WebGLRenderer` (three.js) lives in **exactly one** chunk — `1v02ucy778p2e.js` (~868 KB).
- That chunk has **0 references in `build-manifest.json`** → it is in **no route's initial JS**.
- It is registered only in the **auth routes'** `react-loadable-manifest.json` (dynamic id 2937)
  → loaded lazily, on demand. Non-auth routes never reference it.
- The chunks that reference it (28 KB island + 1 KB loader) contain **zero** `WebGLRenderer`.

→ The app/data bundle ships **zero three.js**; the 868 KB 3D chunk loads only on auth routes,
only when the gate passes.

## Performance

- DPR capped `[1, 1.5]`; `drei <PerformanceMonitor>` drops to 1 on weak GPUs (`setDpr`).
- ~260 charcoal icosahedra (one draw call) + ~20 amber-emissive octahedra glints (one draw
  call). Matrices set once in `useLayoutEffect`; rotated each frame via refs — **no setState
  in the loop**, no per-frame allocation. Cursor parallax is delta-damped (`MathUtils.damp`,
  frame-rate independent).
- Render loop pauses entirely on `visibilitychange` (`frameloop` → `"never"`).
- Glow via cream `fogExp2` + emissive `toneMapped={false}` material — **no postprocessing bloom**.
- Geometry/material declared as JSX children → R3F auto-disposes on unmount.
- Measured: **60 fps** (vsync-locked) on `next start`, real GPU.

## The static fallback

`hero-static.tsx` — pure CSS gradients + one inline SVG (faceted charcoal shards, amber
key-light blooms, emissive glints, vignette). Zero WebGL. It paints first, then the canvas
crossfades over it. Renders for: mobile/touch (coarse pointer), `prefers-reduced-motion`
(via the centralized hook), Data-Saver, low-core, and no-WebGL / context-loss.

## Verification (`docs/ui-audit/tools/capture-auth-hero.mjs`)

- **Live 3D** mounts on `/login` (headed Chrome, real GPU); **60 fps**; **console errors: NONE**.
- **AA contrast** — worst-case frosted form-column bg over the live backdrop = `rgb(35,35,35)`
  (the 0.92 scrim dominates, so it holds even over pure-white backdrop): labels **14.4:1**,
  sub-text **6.58:1**, faint footer **4.62:1** — all ≥ 4.5 (WCAG AA).
- **Fallback fires** on mobile, reduced-motion, and no-WebGL — each renders with **no canvas**
  (static composition). Captures in `fallbacks/`.
- Captures: `login-live.png`, `login-drift-{a,b}.png` (parallax/drift), `accept-invite-welcome.png`,
  `forgot-password.png`.
