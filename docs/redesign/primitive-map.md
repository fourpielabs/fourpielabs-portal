# Redesign R1 — Primitive Map (shadcn/ui → Fluent UI v9)

How every `components/ui/*` primitive maps onto Fluent UI React v9 + the R0 Warm Obsidian
ember-glass tokens. The R1 wrapper layer lives in **`components/redesign/ui/`** so R2/R3 import
from one place. Glass rule (from R0, unchanged): glass only on chrome/overlays/auth-hero/
KPI-summary-with-scrim; **inputs, tables, running text, and all data primitives are SOLID.**

## Dependency / net-new flags

- **⚠️ `@fluentui/react-datepicker-compat` is NOT installed.** Fluent v9 core ships no Calendar/
  DatePicker; the compat package wraps the **same `react-day-picker`** the app already uses. R1
  **keeps the existing `react-day-picker`-based `calendar`/`date-picker`/`date-range-picker`**
  (re-skinned to solid + amber tokens) rather than adding a dependency for chrome-only R1. Adding
  the compat lib is an R2 decision (flagged, not done).
- **Progress is net-new.** There is no shadcn `progress` primitive (the app draws inline bars; R0
  has a custom `Progress` in `data-ui.tsx`). Fluent ships **`ProgressBar`** — added to the layer.
- **Toaster swap deferred.** `sonner` powers global `toast()` in ~many page bodies (SACRED in R1).
  We add a Fluent **`Toaster` + `useToastController`** wrapper for new code but do **not** rip out
  sonner yet (two toasters would collide). Swap happens when bodies convert (R2/R3). Flagged.

## Icon decision — **keep `lucide-react`**

61 distinct lucide icons across **68 files** (incl. page bodies R1 must not touch). `@fluentui/
react-icons` (v2.0.330) IS installed, but lucide is deeply embedded, R0 already standardized on
it, and lucide SVGs compose with Fluent (sized/colored by props/CSS). A wholesale swap is cosmetic
churn with bundle parity. **Decision: lucide stays** as the app icon set; Fluent components' own
built-in glyphs (Menu chevrons, Checkbox tick, Combobox expand) are used where Fluent renders them
internally. (Sample mapping kept for reference if a future phase standardizes: `Check→Checkmark`,
`Pencil→Edit`, `Plus→Add`, `Trash2→Delete`, `FileText→Document`, `X→Dismiss`, `Bell→Alert`.)

---

## Forms (all SOLID)

| shadcn | Fluent v9 | Key prop/slot differences | Approach |
|---|---|---|---|
| `Input` | `Input` | controlled `value`/`onChange(_,data)`; `appearance` (outline/underline/filled-*) + `size`; slots `contentBefore`/`contentAfter`/`input` | thin wrapper, `appearance="outline"`, amber focus via theme |
| `Textarea` | `Textarea` | `value`/`onChange(_,data)`; `resize` default `none`; `appearance`/`size` | thin wrapper |
| `Label` | `Label` | adds `required`, `weight`, `size`; `htmlFor` same | thin wrapper |
| `Field` (new) | `Field` | wraps a control with `label`/`validationState`/`validationMessage`/`hint` | use for form rows (focus/error/validation states) |
| `Checkbox` | `Checkbox` | `checked: boolean\|'mixed'`, `onChange(_,data)`, built-in tick (drop the lucide `Check` indicator), `labelPosition`, `shape` | wrapper; remove Indicator JSX |
| `Switch` | `Switch` | `size` small/medium (map `sm→small`,`default→medium`), built-in thumb, `labelPosition`, `onChange(_,data)` | wrapper |
| `Select` | **`Select`** (native `<select>`) or **`Combobox`** | radix Select (10+ slots) ≠ Fluent native select; **NO clean 1:1** | **default to native `Select`** (solid, simple); use `Combobox` only when search/custom-render needed |
| `Segmented` | **none** | Fluent has no segmented control | **custom** `Segmented` on Fluent `ToggleButton`s + R0 tokens (pill row) |
| `FileDropzone` | **none** | no Fluent dropzone | **keep custom**; trigger restyled with Fluent `Button` |
| `Calendar`/`DatePicker`/`DateRangePicker` | (compat, not installed) | both sides use `react-day-picker` | **keep current**, re-skin solid+amber; compat swap = R2 |

## Actions & feedback (all SOLID)

| shadcn | Fluent v9 | Key differences | Approach |
|---|---|---|---|
| `Button` | `Button` | `appearance` primary/secondary/outline/subtle/transparent; `icon` slot + `iconPosition`; `<a>` native (no Slot); `disabledFocusable` | wrapper maps sizes; **default = secondary**, **primary = amber (`#b45309` light / bright-fill+charcoal dark)** |
| Button **amber/ember CTA** | **none** | bespoke gradient `--amber-cta` + `--shadow-amber`; no Fluent appearance | **custom `EmberButton`** on R0 tokens (the one bold CTA) |
| Button **loading** | (compose) | no native loading prop | wrapper adds `<Spinner size="tiny">` + `disabled` + `aria-busy` |
| `Badge` | `Badge` (+`CounterBadge`) | `appearance`×`color` (not single `variant`); `icon` slot | wrapper maps variant→{appearance,color}; `CounterBadge` for the bell count |
| `StatusChip` | (Badge-ish) | STATUS_MAP-driven, dashed borders, lucide glyphs — **bespoke** | **keep** R0 `StatusPill` (mode-aware, AA) from `data-ui.tsx` |
| `Banner` | Alert(deprecated)/MessageBar(not installed) | Fluent Alert deprecated | **keep custom** banner on R0 tokens |
| `Skeleton` | `Skeleton`+`SkeletonItem` | composition + `animation` wave/pulse + `shape`/`size` | wrapper (wave) |
| `Separator` | `Divider` | `orientation→vertical` bool; drop `decorative`; `appearance`/`inset`/`alignContent` (supports label) | wrapper |
| `EmptyState`,`MetricDelta`,`MetricValue` | **none** | domain/layout, not primitives | **keep** (R0 already re-implements these) |
| `Progress` (net-new) | `ProgressBar` | `value` 0–1, `thickness`, `color` | wrapper (amber) |

## Overlays & menus (chrome/overlays → glass ALLOWED on the surface; controls solid)

| shadcn | Fluent v9 | Key differences | Approach |
|---|---|---|---|
| `Dialog` | `Dialog` | `DialogSurface/Body/Title/Content/Actions/Trigger`; `modalType` modal/non-modal/alert | wrapper; surface may be glass, body content solid |
| `AlertDialog` | `Dialog modalType="alert"` | merged into Dialog | wrapper |
| `ConfirmDeleteDialog` | compose | — | Dialog + `EmberButton` destructive |
| (mobile sheets) | **`Drawer`** (`react-drawer`, installed) | `type` overlay/inline, `position`, `size` | use Drawer for the staff mobile nav + client "More" sheet |
| `DropdownMenu` | `Menu` | `MenuTrigger`(`disableButtonEnhancement` for custom triggers)/`MenuPopover`/`MenuList`/`MenuItem`/`MenuDivider`/`MenuGroup(Header)`; `onOpenChange(e,data)` | wrapper; **bell + user-menu + client-switcher use this** |
| `Popover` | `Popover` | `PopoverTrigger`/`PopoverSurface`; `positioning`; `withArrow` | wrapper |
| `Tooltip` | `Tooltip` | **`relationship` REQUIRED** (`label`/`description`/`inaccessible`); `content`; `positioning`; `withArrow` | wrapper defaulting `relationship="label"` |
| `sonner` toast | `Toaster`+`useToastController`+`useId` | `dispatchToast(<Toast><ToastTitle/></Toast>,{intent})` | wrapper helper; **global swap deferred** (see flags) |

## Data & nav (all SOLID)

| shadcn | Fluent v9 | Key differences | Approach |
|---|---|---|---|
| `Card` | `Card` (or R0 `.rd-solid`) | this is the **solid** data card | wrapper = R0 solid surface (warm, AA) |
| `Table` | `Table` (or `DataGrid`) | `Table/TableHeader/TableRow/TableHeaderCell/TableBody/TableCell`; DataGrid adds sort/select | wrapper basic `Table` (solid); DataGrid only where sorting needed |
| `Tabs` | `TabList`+`Tab` | `selectedValue`/`onTabSelect(e,data)`; Fluent has its OWN animated indicator (replaces the Motion `layoutId` pill) | wrapper |
| `Avatar`/`PersonAvatar` | `Avatar` | `name`/`image`/`color`/`size`/`badge`; initials+color auto | wrapper |
| `BrandLogo` | (img) | n/a | **keep** as-is |

---

## App shells (STEP 3 blueprint — wiring to PRESERVE)

**Client shell** (`components/shell/client-shell.tsx`): desktop floating **pill** top-nav + mobile
compact header + mobile **bottom-tab bar** + "More" sheet.
- TOP (program): Dashboard, Messages, Program, Content, Performance, Deliverables, Tasks,
  Calls & Notes, Documents. BOTTOM: Home, Program, Content, Numbers + More(Messages, Deliverables,
  Tasks, Calls & Notes, Documents).
- **project client**: `PROGRAM_ONLY = {/program,/performance,/content}` hidden; BOTTOM_PROJECT
  (Home, Messages, Deliverables, Calls) + MORE_PROJECT (Tasks, Documents).
- active: `pathname===href || startsWith(href+"/")`. Active pill = Motion `layoutId="client-nav-pill"`.

**Staff shell** (`components/shell/staff-shell.tsx`): collapsible dark **sidebar** + client switcher
+ mobile drawer.
- nav: Dashboard, Clients; **admin only**: Users (`/admin/users`), Audit log (`/admin/audit`) (with
  "Admin" badge). active: dashboard exact, else startsWith.
- **ClientSwitcher** (`role !== "admin"`, i.e. team): dropdown → `/clients/{id}`; "No clients yet".
- collapsible (264↔76px) with tooltips when collapsed.

**Shared chrome:** `NotificationBell` (actions `getNotificationsAction`/`markNotificationReadAction`/
`markAllNotificationsReadAction` + Supabase realtime on `notifications` INSERT + unique channel
name per mount) and `UserMenu` (hidden `<form action="/auth/signout" method="post">` + links to
`/settings`). **All of this wiring is reused verbatim; only the rendering swaps to Fluent Menu +
ember-glass.** The R0 Dark/Light toggle is promoted from the floating pill into the shell.

**Mount architecture (decided):** `FluentProvider` sets `backgroundColor: colorNeutralBackground1`
on its root, so wrapping the (still-Tailwind) R1 page bodies in it would override the app's cream/
obsidian background. Therefore **FluentProvider is scoped to the chrome regions only**; the page
bodies render OUTSIDE any FluentProvider (untouched) until they convert in R2/R3. The Griffel SSR
registry + the redesign mode context sit at the portal layout; each chrome region is its own
`FluentScope`. Theme `fontFamilyBase` is set to the Inter var so chrome matches the app.
