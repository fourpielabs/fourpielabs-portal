# Current Design Tokens (As-Implemented)

_Extracted verbatim from [app/globals.css](../../app/globals.css), [components.json](../../components.json),
and [app/layout.tsx](../../app/layout.tsx). These are the **live** values, not the design-doc
intent (see [drift.md](./drift.md) for the diff)._

**Format:** every color is authored as **hex** (or `rgba()` for shadows/overlays). **No HSL,
no OKLCH** anywhere. Tokens live in a Tailwind v4 `@theme { … }` block (so `--color-bg`
becomes the `bg-bg` utility, etc.) plus a `:root { … }` block for non-utility design vars.

## Fonts (loaded via `next/font/google` in `app/layout.tsx`)

| Role | `@theme` token | Family | Loader var |
|---|---|---|---|
| Body / UI | `--font-sans` | **Inter**, system-ui, sans-serif | `--font-inter` |
| Display / headings | `--font-display` | **Bricolage Grotesque** | `--font-bricolage` |
| Mono | `--font-mono` | **Geist Mono**, ui-monospace | `--font-geist-mono` |

Weights/`display` are **not** pinned in the loader calls — `next/font` ships the variable
fonts with their full axis and `font-display: swap`. `body` sets `font-family: var(--font-sans)`
+ `-webkit-font-smoothing: antialiased`. `.font-display` utility opts into Bricolage.

## Color tokens

### Warm neutrals (light)
| Token | Hex |
|---|---|
| `--color-bg` | `#f7f6f2` |
| `--color-surface` | `#ffffff` |
| `--color-surface-2` | `#f1f0ea` |
| `--color-surface-ivory` | `#fcfbf7` |
| `--color-border` | `#e7e5e0` |
| `--color-border-strong` | `#d6d3cd` |
| `--color-row-divider` | `#f4f4f0` |
| `--color-ink` | `#18181b` |
| `--color-ink-2` | `#57534e` |
| `--color-ink-3` | `#8e8b84` |
| `--color-ink-faint` | `#c7c4bd` |
| `--color-charcoal-hover` | `#2c2c30` |

### Dark set
`--color-dark-bg #101012` · `--color-dark-surface #1a1a1d` · `--color-dark-border #2c2c30`
· `--color-dark-ink #f5f5f3` · `--color-dark-ink-2 #a8a8a3`

### Amber ramp (brand accent)
`50 #fffbeb` · `100 #fef3c7` · `200 #fde68a` · `300 #fcd34d` · `400 #fbbf24` ·
`500 #f59e0b` · **`600 #d97706`** · `700 #b45309` · `800 #92400e` · `900 #78350f`
Aliases: `--color-accent-emphasis` → amber-700, `--color-accent-emphasis-2` → amber-800,
`--color-accent-tint #fdf6ec`, `--color-accent-tint-2 #fbecd6`, `--color-brand` → amber-600.

### Semantic palettes (bg / border / text / dot)
- **success** `#dcfce7` / `#bbf7d0` / `#166534` / dot `#15803d`
- **danger** solid `#dc2626`, hover `#b91c1c`, bg `#fef2f2`, border `#fecaca`, text `#b91c1c`
- **info** `#dbeafe` / `#bfdbfe` / `#1d4ed8` / dot `#2563eb`
- **teal** `#ccfbf1` / `#99f6e4` / `#115e59` / dot `#0d9488`
- **indigo** `#e0e7ff` / `#c7d2fe` / `#4338ca` / dot `#4f46e5`
- **priority** `#fff7ed` / `#fed7aa` / `#9a3412` / icon `#c2410c`

### shadcn semantic mapping (`@theme`)
`--color-background`→bg · `--color-foreground`→ink · `--color-card`→surface ·
`--color-primary`→**ink (charcoal)** · `--color-primary-foreground #ffffff` ·
`--color-secondary`/`--color-muted`/`--color-accent`→surface-2 · `--color-muted-foreground`→ink-3 ·
`--color-destructive`→danger-solid · `--color-input`→border-strong · **`--color-ring`→amber-600**.

## Radius
`--radius-sm 8px` · `--radius-md 12px` · `--radius-lg 16px` · `--radius-xl 24px` ·
`:root --radius: 12px` (shadcn base). **No `--radius-pill` token** — pills use Tailwind
`rounded-full` (9999px) inline (e.g. all buttons).

## Elevation (shadows) — warm umber-tinted `rgba(40,33,24,…)`
- `--shadow-e1` `0 1px 2px rgba(40,33,24,.06), 0 1px 1px rgba(40,33,24,.04)`
- `--shadow-e2` `0 1px 2px rgba(40,33,24,.05), 0 4px 12px -2px rgba(40,33,24,.08), 0 2px 4px -2px rgba(40,33,24,.05)`
- `--shadow-e2-hover` `…10px 22px -4px rgba(40,33,24,.12)…`
- `--shadow-e3` `0 2px 4px …, 0 16px 40px -8px rgba(40,33,24,.13)…`
- `--shadow-inset-top` `inset 0 1px 0 rgba(255,255,255,.9)`
- `--shadow-toast` `0 12px 32px rgba(24,24,27,.25)`
- `--shadow-amber` `0 1px 2px rgba(120,53,15,.25), 0 6px 16px -4px rgba(180,83,9,.35)`

## Motion tokens
- Easings: `--ease-standard cubic-bezier(.2,0,0,1)` · `--ease-out cubic-bezier(.16,1,.3,1)` ·
  `--ease-in-out cubic-bezier(.65,0,.35,1)` · `--spring-tick cubic-bezier(.34,1.56,.64,1)`
- Durations: `--duration-fast 160ms` · `--duration-fast-out 120ms` · `--duration-med 250ms` ·
  `--duration-slow 300ms`
- Intent utilities (in `@layer utilities`): `.motion-micro`, `.motion-state`,
  `.motion-surface`, `.motion-collapsible` (grid-rows 0fr→1fr expand). `@keyframes tickPop`
  (checklist spring). Global `prefers-reduced-motion` reset present.

## Focus / interaction (`:root` + `@layer base`)
- `--focus-field 0 0 0 3px rgba(217,119,6,.18)` (soft amber halo on inputs)
- `--focus-solid 0 0 0 2px #fff, 0 0 0 4.5px #d97706` (double ring on buttons/links)
- Applied globally: `:where(a,button,[role=button],input,select,textarea,[tabindex]):focus-visible`
  → `--focus-solid`; fields → `--focus-field` + amber border. **Amber focus on everything.**

## "Premium surface" / color-refresh vars (`:root`, NOT in the D1/D4 docs)
These were added to the implementation **after** the committed system and have no counterpart
in D1/D4 (see [drift.md](./drift.md)):
- `--surface-card linear-gradient(180deg,#fff,#fcfbf7)` · `--surface-raised linear-gradient(180deg,#fff,#f8f7f2)`
- `--hover-tint #fdf6ec` · `--selected-tint #fbecd6`
- `--amber-cta linear-gradient(180deg,#c2670a,#b45309)` · `--amber-cta-hover linear-gradient(180deg,#a85a0c,#92400e)`
- `--dark-field rgba(255,255,255,.045)` · `--dark-glow` (radial amber) · `--dark-glow-rail` + `--sidebar-dark` (staff rail)
- `--unsaved-bg #fffbeb` · `--pending-row #fffdf5`

## Spacing
**No custom spacing scale is defined** — the project uses Tailwind v4's **default 4px-based
spacing** utilities (`p-4`, `gap-6`, `space-y-3`, …) directly at call sites. The design doc's
"client spacious / staff compact" rhythm (card pad 24–28 vs 20–22) is therefore expressed
ad-hoc per component, not as tokens (see [drift.md](./drift.md), spacing/rhythm).
