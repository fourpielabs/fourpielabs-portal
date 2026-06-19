# Redesign R3 — Staff Workspace + Admin (report)

Branch `redesign/r3-staff` (from the R2 tip). Converts **every staff per-client-workspace
tab and every admin surface** onto the Warm Obsidian ember-glass system (Fluent UI v9 +
Griffel SSR + the R1/R2 primitive layer), inside the R1 `StaffShell` + the new R3
`WorkspaceChrome`. **Presentation only** — no server action, RLS path, RPC, RHF form, or Zod
schema was changed. `main` stays untouched until the R6 cutover.

## Conversion status — every surface ✅

**Per-client workspace chrome**
- `WorkspaceChrome` — ember-glass identity header + tab nav (primary + Fluent "More" menu),
  program/project + admin gating preserved, per-tab width incl. the wide metrics container.

**Per-client tabs (both client types where applicable)**
| Tab | Component(s) | Wave |
|---|---|---|
| Overview | `overview-body` (SOLID summary cards + glass waiting banner) | 2 |
| Messages | `messages-body` + bare R2 `Conversation` (Client / Internal split) | 1 |
| Checklist | `checklist-editor` + `checklist-item-dialog` | 2 |
| Program | `program-body` + `program-form` + `milestones-editor` | 3 |
| Content | `content-calendar` + `content-dialog` (Table/Month Segmented) | 3 |
| Metrics | `metrics-workspace` + `metrics-definitions-manager` + `monthly-entry-grid` + `csv-import` + `metrics-charts`/`metrics-line-chart` (Enter/Preview modes, WIDE) | 4 |
| Competitors | `competitors-manager` | 3 |
| Deliverables | `deliverables-manager` + `deliverable-form-dialog` + `download-button` | 2 |
| Tasks | `staff-task-board` + `task-form-dialog` + `task-detail-dialog` + `task-timer` | 1·2 |
| Calls | `calls-manager` (call types + recordings) | 3 |
| Notes | `notes-manager` | 3 |
| Reports | `reports-manager` (draft vs published) | 3 |
| Updates | `updates-list` (composer, pin) | 3 |
| Files | `files-body` + `file-upload` + `files-list` | 3 |
| Settings (admin) | `client-settings-body` + `assignment-manager` | 5 |

**Admin / top-level**
| Surface | Component(s) | Wave |
|---|---|---|
| Clients list | `clients-list-body` (StaffPageFrame) | 5 |
| New client | `client-create-form` (conditional program/project) | 5 |
| Users | `users-body` + `invite-form` + `user-active-toggle` + `pending-invite-actions` | 5 |
| Audit log | `audit-body` + `audit-filters` (dense SOLID) | 5 |

**Shared kit** (`components/redesign/staff/ui.tsx`): `usePanel`, `StaffPageFrame`,
`StaffPageHeader`, `TitledPanel`, `SectionHead`, `EmptyPanel`, `RowCard`, `Field`,
`FieldGrid`, `FormDialog` (themed Fluent dialog), `ConfirmDelete`, `IconButton`.

## Invariant re-confirmations (post-conversion) — `redesign-r3-complete-verify.mjs` 11/11 ✅

- **Internal-thread boundary** (the most-protected property): staff sees the amber-lock
  "Internal — the client cannot see this" guardrail + "Post internal" composer; a client
  hitting `/clients/<id>/messages?tab=internal` is **redirected to `/dashboard`**; the
  client's own `/messages` exposes **no internal surface**. Thread-access logic / RLS / RPCs
  untouched.
- **Timer (staff-only), first visible conversion** — full state model proven in Wave 1
  (`redesign-r3-verify.mjs`): start → `in_progress`; plain **Stop stays `in_progress`** (does
  NOT auto-complete); **Stop & complete → `done`**; control returns to Start after a plain
  stop. **Absent on every client surface** (no Time tracking, no status control) — re-confirmed
  at completion.
- **Admin guards**: TEAM blocked from `/admin/users` + `/admin/audit`; CLIENT blocked from
  `/clients` + `/admin`; admin **self row has no delete** ("You" marker); the guarded
  hard-delete keeps the type-phrase `ConfirmDeleteDialog` → `deleteUserAction` with the
  server-side self / last-admin blocks.
- **Role visibility**: admin sidebar has Users + Audit; team has Clients but not Users/Audit;
  client shell exposes **0 staff/admin nav links**.
- **Conditional create form**: program shows the tier select, project hides it
  (`program=true project=false`).

## AA (worst-case, light + dark; ring-sampled on glass, disabled controls WCAG-1.4.3-exempt)

| Wave | Samples | Fail |
|---|---|---|
| 1 (chrome · messaging · task detail) | 37 | 0 |
| 2 (Overview · Checklist · Deliverables · Tasks) | 184 | 0 |
| 3 (8 tracker/content tabs) | 376 | 0 |
| 4 (Metrics) | 182 | 0 |
| 5 (Admin) | 189 | 0 |
| **Total** | **968** | **0** |

## Reduced-transparency / reduced-motion

The global fallbacks (`@supports no-backdrop-filter`, `@media (prefers-reduced-transparency:
reduce)`, `@media (prefers-reduced-motion: reduce)` in `app/(redesign)/redesign.css`) are
unchanged from R0–R2 and apply to every converted surface (all chrome uses the same `.rd-glass`
classes → opaque SOLID-card fallback + no entrances). Reduced-motion smoke: the staff
workspace renders correctly with animations disabled (`r3-reduced-motion-overview.png`).

## Real fixes surfaced by verification (also benefit R2)
- `AmbientField` is decorative (`aria-hidden`) but was intercepting clicks → `pointer-events: none`.
- Notification bell unread badge was charcoal-on-red (~3.7:1, the theme's `OnBrand` override) →
  forced white count text (~4.9:1, AA).
- Shared `StatusPill` `toneOf` normalized (underscore→space + word boundaries) so `inactive`
  no longer matches `active`; `onboarding`→amber, `paused`/`inactive`→neutral, `churned`→new
  danger tone (were all falling through to blue).

## Method
Verified waves, each its own green commit (`de0a0b5`, `39b7add`, `b37d3c2`, `0cb2111`,
`aced625`). Waves 3–5 fanned out one agent per surface (disjoint files, mirroring the kit +
reference components) then built + verified centrally; two agents died on API/socket errors and
those surfaces (metrics CSV import; users body + page rewire + the Delete dark-mode color) were
hand-finished. Build green throughout.

## Transitional debt (intentionally deferred)
- Deferred leaf pickers reused as-is (functional, light-only in dark): `DatePicker`,
  `DateRangePicker`, `FileDropzone`, `PersonAvatar`; the type-phrase `ConfirmDeleteDialog`.
- Old Tailwind components remain only as the source of re-exported TYPES (their bodies are no
  longer routed).
- `sonner` toasts retained through R3 (per the standing plan).

## Next
**R4 — the 3D auth hero reconciliation.** (R3 stops here.)
