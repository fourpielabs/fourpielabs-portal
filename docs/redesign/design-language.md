# 4Pie Labs Portal — Redesign R0: Design Language

**Status:** R0 foundation + 3 keystones, for go/no-go. **Branch:** `redesign/foundation`
(off `main`; `main` untouched). **Stack added:** Fluent UI React v9 (`@fluentui/react-components@9.74.1`)
+ a custom "ember-glass" skin on top of Fluent tokens; Motion v12 kept for interaction.
Data/security layer untouched — keystones read real data **read-only** through the existing
RLS-scoped Supabase clients.

> This is a **presentation** rebuild. No server action, query, RLS policy, RPC, or the
> booking/3D logic was modified. The new system is mounted **alongside** the live UI under
> `/redesign-preview/*`; nothing live was replaced.

---

## 1. The brief, pinned

- **Subject:** the client portal for 4Pie Labs — an AI-first marketing agency for local
  service businesses (painters, tour operators, clinics).
- **Audience:** small-business owners, not designers. They check it on a phone between jobs.
- **The page's one job:** make an owner feel their growth is in expert, modern hands — a
  *product*, not an admin panel. The numbers are the product, so the design treats the portal
  as a **measurement room**: an instrument you trust.

This framing drives two specific, non-templated choices below: the **mono "instrument label"**
type signature, and the **ember-glass** surface that lets the brand's existing 3D hero (charcoal
facets catching amber light) become the ambient material of the whole environment.

---

## 2. Palette — options and the locked direction

The existing brand is charcoal / amber (`#d97706`) / cream. The brief allows evolving it. The
[frontend-design skill](../../.claude/skills/frontend-design/SKILL.md) flags the trap directly:
**warm-cream + a terracotta/amber accent is one of the three "AI-default" looks.** The brand is
genuinely warm-amber, so the job is to spend the *free* axis (depth, material, type) somewhere
that is unmistakably 4Pie and not the template.

### Option A — **"Warm Obsidian"** ✅ *chosen*
Keep amber as the single accent; evolve the neutral from "cream paper" toward a **warm
near-black umber** substrate for immersive chrome, heroes, and dark mode — the world the 3D hero
already lives in. Cream survives as the light reading surface and as "frost" (the light glass
tint). Glass panes are edge-lit and carry a warm **ember bloom** that appears to pass through
them. Light mode is the disciplined day surface; dark mode is the showcase.

- substrate (dark): `#14110d` field · `#1c1813` surface · `#241f18` raised
- substrate (light): `#f8f5ef`→`#f3efe6` field · `#ffffff` surface · `#fcfbf7` frost
- ink: `#18181b` (light) · `#f3efe7` (dark)
- amber: `#b45309` interactive (AA) · `#d97706` brand/decorative · `#f59e0b` ember highlight
- **Why it wins:** honors the brand promise but spends the free axis on the *depth* glass
  actually needs; warm-black is decisively **not** the cream template; the ember-glass pane is a
  single ownable signature. A justified risk, specific to this subject.

### Option B — "Ivory & Ember" *(rejected — too close to the default)*
Stay in the warm-light world; glass = frosted-white panes over an ivory gradient. Lower risk,
but it sits right on AI-default look #1, and glass over a light field reads weakly (no depth
contrast). Conservative to a fault.

### Option C — "Slate Aurora" *(rejected — off-brand)*
Cool graphite neutral + a **second** cool accent (teal) for duotone aurora glass. Looks
"futuristic SaaS," but it breaks the single-amber brand truth and drifts toward AI-default #2
(near-black + bright acid accent). Introducing a hue the brand doesn't own is the wrong risk.

**Keystones are built in Option A**, in both light and dark, so the direction is judged visually.

### Fluent themes from the amber ramp
`lib/redesign/brand-theme.ts` builds a 16-step amber `BrandVariants` (anchored on the existing
Tailwind amber scale) and generates `createLightTheme(ramp)` / `createDarkTheme(ramp)` (the
Theme Designer approach), then overrides two things narrowly:

1. **Warmth** — Fluent's stock neutrals are cool greys; the surface / stroke / text tokens that
   components actually paint with (Card, Input, Field, Badge, Divider) are re-pointed to warm
   equivalents so Fluent controls sit in the 4Pie world.
2. **AA on the accent** — white text on the *bright* brand amber `#d97706` is only **3.19:1
   (fails AA)**. So the **interactive** amber differs by mode:
   - light: `brand[80] = #b45309` (amber-700) as the button/link fill → **white text 7.0:1**.
     (This mirrors the live app, which already darkened its CTA to `#b45309` for this reason.)
   - dark: the bright `#d97706` fill is kept for pop on obsidian, but its on-brand text flips to
     charcoal `#1a1410` → **5.48:1**; amber *text/links* use `#fbbf24` (9.6:1 on obsidian).
   The bright `#d97706` / `#f59e0b` live in glints, gradients, and the hero — **never as a
   white-text background.**

---

## 3. The glass language

Glass is a **custom layer on Fluent tokens** — Fluent does not ship it. It lives in plain CSS
(`app/(redesign)/redesign.css`) so the hard a11y rules are auditable in one place, and is applied
via thin helpers (`components/redesign/ui.tsx` → `<GlassSurface>`).

### Token set

| token | light ("frost") | dark ("ember obsidian") |
|---|---|---|
| fill (default) | `rgba(252,251,247,0.72)` | `rgba(26,21,16,0.72)` |
| **fill (strong = the scrim)** | `rgba(252,251,247,0.90)` | `rgba(20,16,12,0.88)` |
| blur | `blur(18px) saturate(140%)` | `blur(20px) saturate(135%)` |
| edge highlight (inset top) | `rgba(255,255,255,0.7)` | `rgba(255,255,255,0.10)` |
| outer hairline | `rgba(40,33,24,0.12)` | `rgba(0,0,0,0.45)` |
| **solid fallback** | `#ffffff` + visible border `#d6d3cd` + contact shadow | `#1c1813` + border `#3a352d` + shadow |
| signature ember bloom | `radial-gradient(135% 120% at 100% -8%, rgba(245,158,11,0.12), transparent 58%)` | same |

The **scrim** is not a separate element — it is the *strong fill* (0.88–0.90 opacity) used on any
glass surface that carries text (KPI / summary). It guarantees the composited background is
dominated by the tint, which is what makes AA provable over a moving backdrop.

### Where glass is ALLOWED vs FORBIDDEN

- **Allowed:** nav / chrome (the sticky top bar), overlays, drawers, modals, the **auth hero
  card**, and **KPI / summary surfaces — with the scrim (strong fill).**
- **Forbidden:** dense data **tables**, **form fields**, and **running text** (report bodies,
  notes). These render on **solid** surfaces (`.rd-solid` / `.rd-solid--dark`).
- **Nuance proven on the auth keystone:** the glass *card* is allowed (auth hero), but the form
  *controls* inside it render **solid** (Fluent inputs on the theme's opaque surface) — "glass
  forbidden on forms" holds **inside** an allowed pane.

### Hard a11y rules (proven, not asserted)

1. **WCAG AA over glass.** Every text-on-glass pair clears 4.5:1 (3:1 for large text). Proven
   empirically — see §6 and `keystones/aa-results.md`.
2. **Solid fallback for every glass surface.** Three triggers each downgrade glass to an opaque
   **card** (fill + visible border + contact shadow), no blur, no ember bloom:
   `@supports not (backdrop-filter)`, `prefers-reduced-transparency: reduce`, and
   `prefers-reduced-motion: reduce`. (The fallback fill is pure white, not ivory, so a solid card
   still reads as a *card* against the warm field.) Screenshot:
   [`redesign-dashboard-reduced-1440.png`](keystones/redesign-dashboard-reduced-1440.png).

---

## 4. Motion + immersive-layout language

### Motion tokens & centralized reduced-motion
The portal's motion source of truth (`lib/motion.ts` springs + `components/motion/motion-provider.tsx`,
`MotionConfig reducedMotion="user"`) is reused; CSS mirrors it (`--rd-ease-out`, `--rd-dur-base`).

**Reduced-motion is treated as a correctness invariant, not a flourish.** During R0 the audit
caught a real bug: the shared JS entrance wrappers (`Stagger`/`StaggerItem`/`FadeIn`) could
strand content at `opacity:0` for reduced-motion users when the reduced-motion detection raced
(production build + React Compiler) — the dashboard greeting and KPI band vanished entirely. The
fix: keystone entrances are now **CSS-driven** (`.rd-rise` / `.rd-pop`) whose **resting state is
always visible** (a `from`-only keyframe with `fill-mode: backwards`), so reduced-motion simply
shows the visible resting state — it can never get stuck hidden. Motion still composes with
Fluent for *interaction* (e.g. the KPI tiles' `whileHover` lift wraps Fluent-tokened content);
that path has no hidden initial state, so it is safe.

### Immersive shell + readable measure
- **Shell** (`.rd-shell`): full-bleed, `min-height:100dvh`, ambient warm field behind, sticky
  glass chrome. The chrome and field go edge-to-edge.
- **Readable measure** (`.rd-measure--{text|standard|wide}` = 720 / 1200 / 1440px): content is
  **always** centered and capped. The immersive part is the *background/chrome*; text, forms, and
  even dense tables keep a readable max-measure (the dense table scrolls horizontally *inside* its
  capped panel rather than sprawling to 2560px). Immersive shell, disciplined content.

---

## 5. SSR / client-boundary approach (+ App-Router friction)

**Decision: a dedicated `(redesign)` route group, not the literal root layout.** R0 must not
disturb the live app, so `FluentProvider` + the Griffel SSR renderer live in
`app/(redesign)/layout.tsx`. Putting them in the root layout would leak Fluent's CSS baseline and
Griffel SSR into every shipping screen. The `(auth)`/`(portal)` groups are untouched; only the
shared `<html>`/`<body>` + `MotionProvider` from the root are inherited (so **Motion composes for
free**). RSC data fetching stays server-side; Fluent renders in client boundaries.

**Griffel SSR registry** (`components/redesign/griffel-registry.tsx`): the App-Router contract is

```tsx
const [renderer] = React.useState(() => createDOMRenderer());
useServerInsertedHTML(() => <>{renderToStyleElements(renderer)}</>);
return <RendererProvider renderer={renderer}><SSRProvider>{children}</SSRProvider></RendererProvider>;
```

`renderToStyleElements` emits `<style data-make-styles-rehydration="true">` into the streamed
HTML; the client renderer rehydrates from those instead of re-inserting → **no FOUC, no hydration
mismatch** (verified: 0 hydration warnings across all keystones).

**App-Router friction encountered & resolved**
- Most "Fluent + App Router" guides online use a `hasMounted` hack that returns `null` on the
  server — that **defeats SSR** (styles only after hydration). We use the correct
  `useServerInsertedHTML` flush instead.
- `@fluentui/react-components@9.74.1` peer-depends `react <20`, so **React 19 is in range** — no
  `--legacy-peer-deps`.
- **React Compiler is on** (`reactCompiler: true`); Fluent/Griffel compile and render cleanly,
  but it contributed to the reduced-motion entrance race in §4 — hence the CSS-entrance fix.
- The `next dev` (Turbopack) server proved unstable under the heavy Fluent+recharts compile;
  screenshots/verification run against `next start` (production output), which is solid. Build
  itself is green.

---

## 6. WCAG AA results

**107 / 107 text samples pass** (`scripts/redesign-verify.mjs` → `keystones/aa-results.md`).

Method (the "sample worst-case" approach): each glass / dark surface is screenshotted; for every
real rendered text color, the background is sampled in a ring **immediately around the actual
text** (the bloom-lit region included) and the **minimum** contrast is reported. Text on solid
controls/panels is scored analytically against its real background. Tightest passing samples:

| surface | text | fg | worst bg | ratio | need |
|---|---|---|---|---|---|
| KPI tile (glass+bloom) | "Map-Pack Keywords" eyebrow | `#b45309` | `rgb(251,247,238)` | **4.70** | 4.5 |
| chrome (glass) | nav "June 2026" muted | `#6f6c66` | `rgb(251,242,226)` | **4.71** | 4.5 |
| KPI tile (glass+bloom) | "Leads" eyebrow | `#b45309` | `rgb(252,250,246)` | 4.82 | 4.5 |

On-field headings (greeting, page titles) are dark-on-light / light-on-dark by construction
(>10:1) and the dense tables / report card are solid surfaces with tokened AA text. Two genuine
issues the audit surfaced were fixed: the ember bloom was lightening the KPI amber eyebrow below
4.5 (bloom reduced 0.18→0.12, scrim raised to 0.90), and the `Eyebrow` "muted" tone was a fixed
grey that failed on dark (now mode-aware).

---

## 7. The three keystones

All under `/redesign-preview/*`, wired to the demo client's real data (read-only).

| keystone | route | proves | desktop | mobile |
|---|---|---|---|---|
| **Auth** | `/redesign-preview/login` | glass card (allowed) over the reused gated 3D hero; single-mode "night" moment; solid form controls inside glass | [1440](keystones/redesign-login-1440.png) | [390](keystones/redesign-login-390.png) |
| **Client dashboard** | `/redesign-preview/dashboard` | glass chrome + glass KPI band (scrim) beside readable **solid** content; light **and** dark | [1440](keystones/redesign-dashboard-1440.png) · [dark](keystones/redesign-dashboard-dark-1440.png) | [390](keystones/redesign-dashboard-390.png) |
| **Performance (dense)** | `/redesign-preview/performance` | the system holds where glass is **forbidden** — charts + month-by-month table on solid surfaces | [1440](keystones/redesign-performance-1440.png) · [dark](keystones/redesign-performance-dark-1440.png) | [390](keystones/redesign-performance-390.png) |

Reduced-transparency / reduced-motion solid fallback:
[`redesign-dashboard-reduced-1440.png`](keystones/redesign-dashboard-reduced-1440.png).

A floating **Dark / Light** pill (preview-only chrome) flips the dashboard/performance themes so
both locked themes are evaluated live.

---

## 8. File map

```
lib/redesign/brand-theme.ts                amber ramp → Fluent light/dark + AA overrides
app/(redesign)/redesign.css                glass tokens · a11y fallbacks · shell/measure · CSS motion
app/(redesign)/layout.tsx                  GriffelRegistry → ThemedFluent (route-group scope)
components/redesign/griffel-registry.tsx   Griffel SSR (useServerInsertedHTML)
components/redesign/themed-fluent.tsx      FluentProvider + light/dark mode + toggle pill
components/redesign/ui.tsx                  Shell · AmbientField · Measure · Eyebrow · GlassSurface
components/redesign/chrome.tsx             shared glass chrome bar + live pill
components/redesign/data-ui.tsx            StatusPill · DeltaChip · Progress (mode-aware, AA)
components/redesign/keystones/*            dashboard · performance · perf-chart
app/(redesign)/redesign-preview/*          index + the 3 keystone routes (server data fetch)
scripts/redesign-verify.mjs                screenshots + worst-case AA audit
docs/redesign/keystones/                   screenshots + aa-results.md
```

## 9. Verify

```
npm run build                              # green; tsc clean; 0 hydration warnings
npx next start -p 3005                     # then:
BASE=http://localhost:3005 node scripts/redesign-verify.mjs   # screenshots + AA (107/107)
```
