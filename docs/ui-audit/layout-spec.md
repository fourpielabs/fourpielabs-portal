# Layout & Spacing System — Phase 1, Batch 1

The canonical spec for the portal's layout primitives + spacing/density tokens. Fixes
audit findings **#1** (inconsistent page headers), **#2** (no spacing/density system), and
**#4** (edge-to-edge / ragged list-board pages). **No color or type token VALUES changed** —
this batch only ADDS spacing/density tokens and two primitives, then adopts them per route.

---

## STEP 1 — Derived spec (measured from the surfaces that already read premium)

Values were taken from the existing hero surfaces so the system harmonizes with what works:

| Property | Measured source | Chosen value |
|---|---|---|
| Section rhythm (between major blocks) | client dashboard `flex … gap-8`; performance `gap-8` | **32px** spacious |
| Standard page title | client page `h1` = `text-3xl` | **30px** (Bricolage, −0.015em) |
| Side padding (responsive) | client shell `px-4 sm:px-8` | **16 → 24 → 32** |
| Content width — standard | client shell `max-w-[1280px]`, staff `max-w-6xl` (1152) | **1200** |
| Content width — focused | settings `max-w-xl` (576, too narrow per audit) | **720** |
| Content width — wide | new (dense tables had only 1152) | **1440** |
| Staff/compact section rhythm | staff `space-y-6` | **24px** |
| Staff/compact page title | per-client name `text-2xl` | **24px** |

---

## STEP 2 — Tokens added ([app/globals.css](../../app/globals.css))

### Container widths (in `@theme` → generate `max-w-focused / max-w-standard / max-w-wide`)
| Token | Value | Use |
|---|---|---|
| `--container-focused` | `45rem` (720) | forms, reading, single-record |
| `--container-standard` | `75rem` (1200) | dashboards, detail, most pages |
| `--container-wide` | `90rem` (1440) | dense tables, boards |

### Responsive side-padding (density-independent)
| Token | Mobile | ≥640 | ≥1024 |
|---|---|---|---|
| `--page-px` | `1rem` | `1.5rem` | `2rem` |

### Density-switchable rhythm (defaults = **spacious**; `[data-density="compact"]` overrides)
| Token | spacious (client) | compact (staff/admin) |
|---|---|---|
| `--section-gap` | `2rem` (32) | `1.5rem` (24) |
| `--stack-gap` | `1rem` (16) | `0.75rem` (12) |
| `--card-pad` | `1.5rem` (24) | `1.25rem` (20) |
| `--page-title` | `1.875rem` (30) | `1.5rem` (24) |

Density is set by the shells: **client shell → `data-density="spacious"`**, **staff shell →
`data-density="compact"`** (so it cascades to every page; a `PageContainer density` prop can
override per-subtree). Utilities: `.section-stack` / `.content-stack` (flex-col with
`--section-gap` / `--stack-gap`).

---

## STEP 3 — Primitives

### `<PageContainer>` — [components/layout/page-container.tsx](../../components/layout/page-container.tsx)
Owns width, centering, responsive side-padding, and density. Sits INSIDE the shell (the shells
no longer set width/padding), so `wide` can exceed the old 1280 cap.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `width` | `"focused" \| "standard" \| "wide" \| "full"` | `"standard"` | → `max-w-*` |
| `density` | `"spacious" \| "compact"` | — | override; else inherits the shell |
| `stack` | `boolean` | `false` | flex-col with `--section-gap` (page rhythm column) |
| `className` | `string` | — | |

### `<PageHeader>` — [components/layout/page-header.tsx](../../components/layout/page-header.tsx)
One header scale, sized by inherited density. Designed as the first child of a `<PageContainer
stack>` (rhythm to content comes from the container gap, so it adds no margin of its own).

| Prop | Type | Notes |
|---|---|---|
| `eyebrow?` | `ReactNode` | overline (11px/700/uppercase/ink-3) |
| `title` | `ReactNode` | `font-display`, `var(--page-title)` |
| `description?` | `ReactNode` | ink-2, max ~68ch |
| `actions?` | `ReactNode` | right-aligned desktop, wraps below title on mobile |

```tsx
// standard pattern
<PageContainer width="standard" stack>
  <PageHeader title="Deliverables" description="Everything we're creating for you." />
  {/* sections… separated by --section-gap */}
</PageContainer>

// hero exception (NOT forced through PageHeader)
<PageContainer width="standard">
  <ClientDashboard … />   {/* owns its own greeting + gap-8 */}
</PageContainer>
```

---

## STEP 4 — Route → (width, density) map

Density is inherited from the shell (client = spacious, staff/admin = compact); listed for clarity.

| Route | width | density | notes |
|---|---|---|---|
| `/dashboard` (client) | standard | spacious | **hero** greeting+KPI preserved (no PageHeader) |
| `/dashboard` (project board) | standard | spacious | **hero** greeting preserved; grid equalized |
| `/dashboard` (staff) | standard | compact | greeting preserved; client grid equal-height |
| `/settings` | focused | (role) | form; was `max-w-xl` 576 → 720 |
| `/messages` | standard | spacious | conversation |
| `/program` | standard | spacious | detail cards |
| `/content` | standard | spacious | calendar |
| `/performance` | standard | spacious | PageHeader + **chart card preserved**; competitors equal-height |
| `/deliverables` | standard | spacious | list → 1→2-col equal-height grid |
| `/tasks` | standard | spacious | list → 1→2-col equal-height grid |
| `/calls-notes` | standard | spacious | cards + lists |
| `/documents` | standard | spacious | file lists |
| `/clients` | standard | compact | table + `New client` action |
| `/clients/new` | focused | compact | form |
| `/admin/users` | wide | compact | dense user table |
| `/admin/audit` | wide | compact | dense audit table |
| `/clients/[clientId]/*` | standard | compact | **one** container in the workspace layout; 16 tabs inherit |

**Hero exceptions (preserved, not forced through PageHeader):** `(auth)/login`, the client
dashboard greeting + KPI band + dark report card, the performance amber chart, the
project-board greeting.

**Step 5 (grids):** client `/deliverables` + `/tasks`, the project board, the performance
competitors, and the staff client grids use `grid items-stretch … lg:grid-cols-2/3` with
`h-full` cards → equal-height, no edge-to-edge stretch. Tables stay in their scroll wrappers
at the capped width.
