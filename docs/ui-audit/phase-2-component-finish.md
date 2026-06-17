# Phase 2 — Component Finish (findings #5, #6, #7)

Builds on the phase-1 layout system. **No color/type token VALUE changed** (only ADDED
delta tokens); no functionality/routing/data/copy/metric-model/upload-logic change.

## #5 — Metric numerals (the numeral becomes the dominant element)

Primitives: [components/ui/metric-value.tsx](../../components/ui/metric-value.tsx) (`<MetricValue>`)
+ [components/ui/metric-delta.tsx](../../components/ui/metric-delta.tsx) (`<MetricDelta>`), applied
everywhere a key metric renders so the treatment is consistent.

| Site | before | after |
|---|---|---|
| Client dashboard KPI band (hero) | 40px Bricolage | **48px** Bricolage, badge delta — band stays a hero, enhanced |
| Staff overview "Latest metrics" snapshot | 19px Inter | **30px** Bricolage — dominant, still fits the 3-card overview row |
| Performance / staff "Month by month" table | Inter tabular, red/green delta | Inter tabular + **warm delta tokens** |

- **Numeral font:** Bricolage (display) for card/snapshot numerals; the **month-by-month
  table keeps Inter's tabular figures** (true column alignment — the design doc's tabular
  requirement matters most there, and each card shows a single number so display character
  wins). All numerals use `tabular-nums`. _(Note made per the brief's font fallback clause.)_
- **Sizes:** `hero` 48 / `card` 44 / `snapshot` 30 (hero + snapshot in use).
- **Delta:** arrow + value + a muted "vs {period}" context line; `badge` (filled pill, hero)
  vs `inline` (text, tables/snapshots). Glyph + color (colorblind-safe).
- **New warm-harmonized delta tokens** (added to `@theme`; no existing color changed):
  `--color-delta-up #15803d` / `--color-delta-up-bg #dcfce7` (forest green) ·
  `--color-delta-down #b23a1e` / `--color-delta-down-bg #fbeae3` (warm brick — not stoplight
  red, tuned to sit beside the amber accent).

## #6 — Metrics editor + width resolution

- **Mode split** ([components/metrics/metrics-workspace.tsx](../../components/metrics/metrics-workspace.tsx)):
  a `SegmentedControl` at the top → **"Enter data"** (default) and **"Client preview"**.
  - _Enter data:_ the monthly entry grid is the primary surface (definitions left, status
    right); **CSV import moved into the header** as an "Import CSV" dialog (was a stacked
    full-width section).
  - _Client preview:_ read-only — exactly what the client sees (chart + tables), **capped to
    the client's `standard` width** inside the wide tab so it mirrors the real client view.
  - Presentation/composition only — same data fetches, actions, and CSV import logic.
- **Per-tab width** ([components/layout/workspace-container.tsx](../../components/layout/workspace-container.tsx)):
  a client `WorkspaceContainer` reads `usePathname` and renders `PageContainer width="wide"`
  for `/metrics`, `"standard"` for every other tab. **Only Metrics is widened** — Content,
  Competitors, Deliverables were considered and kept at `standard` (their tables scroll fine;
  Metrics is uniquely dense with the entry grid + the all-numeric month-by-month table).

## #7 — Pickers (every native date/file input replaced)

Added the shadcn **Calendar + Popover** (installs **react-day-picker v10** + date-fns; the
sanctioned dependency). Built [`<DatePicker>`](../../components/ui/date-picker.tsx) (single) and
[`<DateRangePicker>`](../../components/ui/date-range-picker.tsx) (window) — token-matched, values
round-trip as the existing `YYYY-MM-DD` strings (no schema change).
_(The CLI clobbered our bespoke `button.tsx`; reverted — out-of-scope #3 untouched.)_

**Date inputs replaced — 16 across 13 forms:**

| Form | field(s) | control |
|---|---|---|
| deliverable-dialog | due_date | DatePicker |
| content-dialog | publish_date | DatePicker |
| calls-manager | call_date | DatePicker |
| task-form-dialog (staff) | due_date | DatePicker |
| client-task-dialog | due_date | DatePicker |
| task-create-dialog | due_date | DatePicker (local state) |
| notes-manager | meeting_date | DatePicker |
| milestones-editor | due_date | DatePicker |
| client-create-form | start_date | DatePicker |
| client-edit-form | start_date | DatePicker |
| **reports-manager** | period_start + period_end | **DateRangePicker** ("Reporting period") |
| **project-form-dialog** | start_date + due_date | **DateRangePicker** ("Dates") |
| **program-form** | start_date + end_date | **DateRangePicker** ("Program dates") |

**File inputs:**
- Raw native inputs → styled **`FileDropzone`** (reuses the existing upload action;
  presentation swap only): **deliverable-dialog** (attach/replace file), **reports-manager**
  (attach/replace PDF, `accept=application/pdf`).
- Already-styled (hidden input behind a styled trigger — correctly left as compact controls,
  a drop-zone there would be worse UX): **avatar-upload** ("Change photo" + PersonAvatar
  preview), **conversation** (paperclip + file chip + the inline `MessageAttachment` image
  preview), **csv-import** (already uses `FileDropzone`). The existing inline image-preview
  component (`MessageAttachment`) remains in use for message attachments; form uploads are
  documents/PDFs and show the filename in the dropzone.

## Verify
- build green · `tsc` clean · no new lint errors · 0 route redirects (no behavior change).
- Adversarial phase-1→phase-2 review across all routes (see [phase-2-before-after/](./phase-2-before-after/) + the chat report).
