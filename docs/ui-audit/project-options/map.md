# Phase-3 Advanced Project Options — Map (current state + build plan)

Scope: add **project priority** + a **client-desired target date**, and upgrade the
project **description into a real "brief" textarea** (no new column). Clients set
`priority` + `target_date` + `brief` via the `create_project`/`update_project` RPCs;
staff set everything via direct table writes. The client `target_date` is labeled
distinctly from the staff-managed `due_date`. **The project-status lock and
staff-only `due_date` both continue to hold** (see the no-escalation argument below).

Suite baseline at the start of this work: **`npm run test:rls` → 239/239**.

---

## 1. Current state (what already exists on disk)

> ⚠️ A reader earlier reported the migration as EMPTY. It is **NOT** — the migration,
> the Zod schemas, the constants, and the two client actions are already written.
> The remaining gaps are in the **two dialogs**, the **two cards**, the
> `staffUpdateProjectAction` write, the `StatusChip priority/urgent` recipe, and the
> **RLS tests**. This doc reflects on-disk reality as of 2026-06-18.

### 1a. Migration — ALREADY WRITTEN (not yet verified by `db push`/`reset`)
`supabase/migrations/20260618143121_project_advanced_options.sql` (108 lines):
- `create type public.project_priority as enum ('low','medium','high','urgent');`
- `alter table public.projects add column priority project_priority not null default 'medium', add column target_date date;`
- DROPs `create_project(text,text)` and recreates it as
  `create_project(p_title text, p_description text, p_priority project_priority default 'medium', p_target_date date default null)`
  — status still **hard-coded `'proposed'`**; `due_date` NOT set (staff-only).
- DROPs `update_project(uuid,text,text)` and recreates it as
  `update_project(p_id uuid, p_title text, p_description text, p_priority project_priority default 'medium', p_target_date date default null)`
  — **SET clause = title, description, priority, target_date ONLY** (no `status`, no `due_date`).
- re-`revoke`/`grant execute` on the new 4-arg / 5-arg signatures to `authenticated` (revoke public, anon).
- No new client INSERT/UPDATE policy (RPC-only invariant preserved).

### 1b. Zod schemas — ALREADY WRITTEN — `lib/schemas.ts`
- `projectPriority = z.enum(["low","medium","high","urgent"])` (line 76).
- `projectCreateSchema` (78-83): `{ title, description?, priority, target_date? }` (`target_date` = `optionalDate`, YYYY-MM-DD or "").
- `projectUpdateSchema` (88-90): `projectCreateSchema.extend({ id: uuid })`.
- `projectStaffSchema` (96-104): `{ title, description?, status, priority, start_date?, due_date?, target_date? }`.
- `optionalDate` helper (12-16) unchanged.

### 1c. Constants — ALREADY WRITTEN — `lib/constants.ts`
- `PROJECT_PRIORITIES = [{low},{medium},{high},{urgent}]` (49-54). (`PROJECT_STATUSES` 36-41 unchanged.)

### 1d. Client actions — ALREADY WRITTEN — `lib/actions/projects.ts`
- `createProjectAction` (39-75): passes `p_priority: v.priority`, `p_target_date: clean(v.target_date)` to the RPC; audit metadata adds `priority`.
- `updateProjectAction` (77-124): passes `p_priority`, `p_target_date`; status/due_date intentionally NOT passed.
- `staffCreateProjectAction` (132-171): **writes** `priority: v.priority`, `target_date: clean(v.target_date)` (and status/start/due) directly.

### 1e. Staff projects page query — ALREADY WRITTEN
`app/(portal)/clients/[clientId]/projects/page.tsx:30` selects
`id, title, description, status, priority, start_date, due_date, target_date` — so the
new columns already flow into `StaffProject`. (No change needed here.)

---

## 2. Gaps — what STILL must be built

### G1 — `staffUpdateProjectAction` does NOT write priority/target_date (BUG)
`lib/actions/projects.ts:186-196` — the `.update({...})` object is
`{ title, description, status, start_date, due_date }`. It is missing
`priority: v.priority` and `target_date: clean(v.target_date)`. (Create writes them;
update silently drops them.) **Add both keys** so a staff edit persists priority/target.

### G2 — Staff dialog has no priority Select and no target-date picker — `components/projects/project-form-dialog.tsx`
- `StaffProjectRow` type (36-43) is `{ id, title, description, status, start_date, due_date }` — **add `priority: ProjectStaffValues["priority"]` and `target_date: string | null`**.
- `defaultValues` (69-75) — add `priority: project?.priority ?? "medium"` and `target_date: project?.target_date ?? ""`.
- Add a **Priority** control: clone the Status `<Controller>` + shadcn `<Select>` block (118-135), mapping `PROJECT_PRIORITIES` (import from `@/lib/constants`).
- Add a **Target date** control: a single `<Controller name="target_date">` wrapping `<DatePicker value={field.value} onChange={field.onChange} />` from `components/ui/date-picker.tsx` (round-trips the same `YYYY-MM-DD` string). Import `DatePicker`.
- **Grid restructure** (current 2-col holds Status + the start–due `DateRangePicker`): make it Status + Priority on one `grid-cols-2` row, then the existing `DateRangePicker` (label it **"Schedule (start – due)"** so the staff "due" reads as the internal schedule), then the new **"Target date"** `DatePicker` on its own labeled row. See §4 for the label decisions.

### G3 — Client dialog has no priority / target-date / brief upgrade — `components/client/project-dialog.tsx`
- `ProjectRow` type (31-39) is `{ id, title, description, status, due_date, created_at }` — add `priority: "low"|"medium"|"high"|"urgent"` and `target_date: string | null` (drop nothing; `due_date` stays for read-only display per §4). The card extends it locally with `start_date`.
- `useForm<ProjectUpdateValues>` (53-69) — `defaultValues` add `priority: project?.priority ?? "medium"`, `target_date: project?.target_date ?? ""`.
- Add a **Priority** `<Controller>` + `<Select>` over `PROJECT_PRIORITIES`. Switch the form to also use `control` (currently only `register`).
- Add a **Target date** `<DatePicker>` (`<Controller name="target_date">`) labeled **"Target date"** (the client-facing desired date — NOT "Due").
- The **Description → Brief**: a `<Textarea rows={3}>` already exists (lines 106-114) — relabel the field "Brief" and (optionally) bump rows for a roomier brief; **no schema/column change** (reuses `description`). If the team wants the label "Brief" client-side too, change the `<Label>`/placeholder copy only.
- `onSubmit` (71-89) — pass `priority: values.priority, target_date: values.target_date` into both `createProjectAction` / `updateProjectAction` (currently it only forwards `title`/`description`).

### G4 — Cards don't render priority / target — both cards
- **Staff card** `components/projects/staff-projects-manager.tsx`:
  - Header (102-105) — add `<StatusChip kind="priority" value={p.priority} />` next to the status chip.
  - Dates line (106-112) — add a **`Target ${formatDate(p.target_date)}`** segment (keep `Due ` for `due_date`). The `StaffProject` type already carries `priority`/`target_date` once `StaffProjectRow` (G2) is extended.
- **Client board** `components/client/projects-board.tsx`:
  - Query (34-37) — add `priority, target_date` to the `select`. `BoardProject` (44) extends `ProjectRow`; the added `ProjectRow` fields cover it.
  - Header (97-111) — add `<StatusChip kind="priority" value={p.priority} />` next to the project status chip; render **`Target ${formatDate(p.target_date)}`** in the dates line (keep `Due ` for the staff `due_date`).

### G5 — `StatusChip kind="priority"` has no `urgent` recipe — `components/ui/status-chip.tsx`
- `STATUS_MAP.priority` (49-53) covers only `high`/`medium`/`low`. The enum adds **`urgent`**; without a recipe the chip falls through to the plain fallback span. **Add an `urgent` recipe** (e.g. a red/orange-stronger tone than `high`, `icon: "tri"` or a dot) so urgent renders branded.

### G6 — RLS tests — `scripts/test-rls.ts` (current 239/239)
Build on the existing `projects` block (345-417) and the status-lock pattern (367-393):
- **client can SET priority + target_date** via `create_project` / `update_project` (read back via `admin` and assert the values landed).
- **client CANNOT set status** — keep/extend the existing two proofs: passing `p_status` is rejected (param not in the recreated 5-arg signature → PostgREST no-match) **and** a normal edit leaves status `'proposed'`. (See §"status-lock proof".)
- **client CANNOT set the staff `due_date`** — there is no `p_due_date` param; after a client `update_project`, `admin` re-reads and asserts `due_date` is unchanged (still null on a client-created project).
- **cross-client** create/update still denied (existing line 396-397).
- Total moves **239 → ~244** (5 new checks; the suite total is printed dynamically from `results.length`, so there is no hardcoded number to bump).

---

## 3. The no-escalation argument (why the status lock + staff-due-date hold)

1. **Clients write ONLY through the two SECURITY DEFINER RPCs.** There is still no
   client `INSERT`/`UPDATE`/`DELETE` policy on `public.projects`
   (`20260615181456` lines 48-50; this migration adds none). Direct client table
   writes remain `42501`-denied (proven by the existing tests at 384-393).
2. **The recreated RPCs gain `p_priority` + `p_target_date` and NOTHING else.**
   - `create_project` still **hard-codes `status := 'proposed'`** and does **not**
     set `due_date` (omitted from the INSERT column list → stays NULL).
   - `update_project`'s **SET clause is `title, description, priority, target_date`
     only** — `status` and `due_date` are **absent**, so a client edit preserves both
     untouched. This is the exact mechanism the 2026-06-17 status-lock migration relied
     on (status absent from SET ⇒ preserved); we keep that property and merely add two
     unrelated columns.
3. **No `p_status` / `p_due_date` parameter exists** on either client RPC. A client
   that tries to pass one gets a PostgREST no-match error (the same mechanism that
   makes the existing "p_status REJECTED — param dropped" test pass).
4. **Staff retain full control via direct table writes** under
   `projects_admin_all` / `projects_team_all` (admin / assigned team), scoped
   `.eq("client_id", clientId)` — `status`, `start_date`, `due_date`, `priority`,
   `target_date` are all staff-settable there. Staff status changes still flow through
   `staffSetProjectStatusAction` (notify the client) and `staffUpdateProjectAction`.
5. **`target_date` is a NEW, client-owned column**, deliberately distinct from the
   staff-managed `due_date`. Letting a client set their *desired* `target_date` does
   **not** touch the staff `due_date` and does **not** reverse the "dates are
   staff-managed" decision for `start_date`/`due_date` — those remain RPC-inaccessible
   to clients.

**Conclusion:** the surface a client can write grows by exactly `{priority, target_date}`.
The status lock (`status` never in any client SET clause / param) and the staff-only
`due_date` (never a client param, never in a client SET clause) are both structurally
intact. RLS scoping (own-client-only, type-gated to `project` clients) is unchanged.

---

## 4. Due vs Target — chosen labels (must read unambiguously)

Two date concepts now coexist on a project and must never be confused:

| Field | Owner | Meaning | Card label | Dialog label |
| --- | --- | --- | --- | --- |
| `due_date` | **STAFF** (direct writes) | the internal delivery/schedule deadline | **`Due {date}`** | part of **"Schedule (start – due)"** (the existing `DateRangePicker`) |
| `target_date` | **CLIENT** (via RPC) + staff | the client's *desired* date | **`Target {date}`** | **"Target date"** (single `DatePicker`) |

Rules:
- The **client** dialog exposes **only "Target date"** (never the staff "Due"); the
  client board shows `Target …` for `target_date` and may show `Due …` read-only for
  the staff `due_date` if present.
- The **staff** dialog keeps the start–due range but labels it **"Schedule (start – due)"**
  (so "due" reads as the internal schedule), and adds a separate **"Target date"** picker
  so "Due" vs "Target" are visually distinct.
- On **both** cards: `due_date` prints with the `Due ` prefix, `target_date` prints with
  the `Target ` prefix — never both bare.
