# Foundation Readiness (PROPOSAL — do not execute in Phase 0)

_Steps are written out so Phase 1 can run them deliberately. **Nothing here has been run.**
The only thing this phase changed in the repo is files under `/docs/ui-audit/` (+ an isolated
demo project client in the DB — see [screens/README.md](./screens/README.md))._

## TL;DR of current state
- **Tailwind v4 (4.3.0): already current.** CSS-first, no config file. → _Confirm + adopt fully_, not "upgrade".
- **shadcn 4.11 on Radix (`radix-nova`): already current.** → _Add components carefully_ (don't clobber bespoke ones).
- **React Compiler: already ENABLED** (`reactCompiler: true`). → _Verify_, don't "turn on".
- **`motion`: not installed.** → add.
- **R3F/three: not installed.** → add, route-isolated to `/login`.

---

## 1. Confirm / adopt Tailwind v4 + current shadcn CLI

**Tailwind** is already 4.3.0 with the v4 idiom (`@import "tailwindcss"` + `@theme`, no
`tailwind.config`). Action is confirmation + hygiene, not migration:

```bash
# confirm + patch-bump only
npm view tailwindcss version              # compare to installed 4.3.0
npm i -D tailwindcss@latest @tailwindcss/postcss@latest   # only if a safe patch/minor
```
- **Adopt fully:** introduce the **spacing tokens** the audit calls for as `@theme`
  `--spacing-*` (or a density scale) so findings #1/#2 are systematized in the same place as the
  color tokens.

**shadcn** CLI is 4.11.0 (current). To add the missing specced components:
```bash
npx shadcn@latest add checkbox radio-group calendar popover   # for CC3 styled date/checkbox
```
- ⚠️ **Risk — overwrites.** Many `components/ui/*` are bespoke (button, status-chip, segmented,
  banner, person-avatar…). `shadcn add` will offer to overwrite existing files. **Diff before
  accepting**; add _new_ primitives only, never re-pull customized ones. Keep `components.json`
  `style: radix-nova` so new components match.

## 2. Add `motion` for UI animation

Use the maintained **`motion`** package (the `framer-motion` successor), `motion/react` entry:
```bash
npm i motion
```
- **Usage:** animated components are **client components** (`"use client"`). Wrap enter/stagger
  on list/board pages, page transitions, and micro-interactions. Reuse the existing easing/
  duration tokens (`--ease-*`, `--duration-*`) so motion stays on-system.
- **Respect reduced-motion:** gate with `useReducedMotion()` and keep the existing global
  `@media (prefers-reduced-motion)` reset authoritative.
- **Risks:** (a) **don't also install `framer-motion`** — two runtimes. (b) Bundle: `motion` is
  tree-shakeable; import from `motion/react`, avoid `motion/react-client` barrels. (c) With the
  **React Compiler on**, motion works, but if a specific animated component misbehaves add
  `"use no memo"` at its top as an escape hatch.

## 3. Lazy, SSR-disabled R3F harness — reserved for `/login`

```bash
npm i three @react-three/fiber @react-three/drei
```
Scaffold (Phase 1):
- `components/auth/hero-canvas.tsx` — `"use client"`, the only file importing `three`/R3F.
- Mount it from the auth page via **`next/dynamic` with `{ ssr: false }`** so three.js
  (~150 KB+) is a lazy chunk that loads **only on `/login`** and never touches portal routes:
  ```tsx
  const HeroCanvas = dynamic(() => import("@/components/auth/hero-canvas"), {
    ssr: false,
    loading: () => <CurrentStaticDarkHero />,   // graceful fallback
  });
  ```
- **Fallback = the existing static dark/amber-glow hero** (`public__login__1440` today) for
  reduced-motion, no-WebGL, and the loading state. R3F is an enhancement layer, never required.

**Risks specific to this codebase:**
- **CSP (next.config.ts).** `worker-src 'self' blob:` ✅, `img-src … data: blob:` ✅ (textures as
  data/blob OK), but **`connect-src` is `'self' + supabase only`** and `script-src` has no
  `blob:`. ⇒ **Self-host every 3D asset** (GLTF/HDR/texture in `public/`); an external CDN asset
  URL will be **blocked**. The WebGL canvas itself is not CSP-gated.
- **SSR must be off** — three needs `window`/WebGL; SSR will crash. The `ssr:false` dynamic
  import is mandatory.
- **Bundle/perf** — keep it route-isolated (above) and animation-light; ship a low-poly/shader
  hero, not a heavy scene. Provide the static fallback for low-end devices.
- **React Compiler** — R3F's imperative `useFrame` loop is fine, but if the compiler's
  memoization ever stalls the loop, opt that component out with `"use no memo"`.

## 4. Trial the React Compiler flag — _it's already on_

`reactCompiler: true` is set in [next.config.ts](../../next.config.ts#L59) and
`babel-plugin-react-compiler@1.0.0` is installed. So Phase-1's job is **verification**, not enabling:
```bash
npm i -D eslint-plugin-react-compiler          # surface compiler-unsafe patterns
npm run build                                  # confirm the compiler pass runs (note build time)
```
- **Verify** it's actually compiling (Next prints compiler usage; check that enabling Babel for
  the compiler pass hasn't silently disabled SWC fast-paths → watch build time).
- **Escape hatch:** add `"use no memo"` to any component that regresses — prime suspects are the
  **realtime `conversation.tsx`** (manual subscription/refs) and **recharts** wrappers.
- **Measure before/after:** a quick interaction profile on the client Dashboard + Performance to
  confirm no regression. If build time balloons, consider gating the compiler to `app/` only.

---

## Cross-cutting upgrade risks in _this_ repo
1. **bundle creep** — `recharts@3` already drags in Redux; adding `three` + `motion` grows the
   client. Mitigation: both are lazy/route-scoped (charts already are; R3F→`/login` only;
   `motion` per-component).
2. **Strict CSP** — blocks external assets for both R3F and any motion/lottie remote source.
   Self-host or inline. Update `connect-src`/`img-src` only if a specific need appears (documented as SEC-1).
3. **Next 16 specifics** — middleware is `proxy.ts` (renamed); any guide referencing
   `middleware.ts` must be adapted. App Router + RSC: all of motion/R3F is client-only.
4. **shadcn re-pull hazard** — bespoke `ui/*` components can be silently overwritten; diff every `add`.
5. **Compiler + animation libs** — keep the `"use no memo"` escape hatch handy for imperative/
   realtime/3D components.

> **Recommended Phase-1 order:** (1) page-shell + spacing tokens + button-variant fix _first_
> (biggest perceived-quality win, zero new deps), then (2) `motion`, then (3) the R3F auth hero.
> Verify the React Compiler alongside (1) since it's already on.
