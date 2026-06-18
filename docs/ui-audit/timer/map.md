# Phase 5 — Staff-only Time Tracking: build map

Lead-architect build plan for the staff timer on a task. **The data layer is already
built and matches this design exactly** — `supabase/migrations/20260618160722_task_time_tracking.sql`
(table + partial unique index + staff-only RLS + four SECURITY DEFINER RPCs). The
`formatDuration` helper is also already in `lib/format.ts`. So the remaining work is the
**application layer only**: server actions, the `TaskTimer` UI in the staff detail slot,
the staff fetch wiring, audit constants, and the RLS test group.

---

## What ALREADY exists (do not rebuild)

1. **Migration** `20260618160722_task_time_tracking.sql`:
   - `time_entries(id, task_id→tasks ON DELETE CASCADE, user_id→profiles ON DELETE CASCADE,
     started_at NOT NULL default now(), ended_at NULL=running, created_at)`.
   - Partial unique index `uniq_running_time_entry (task_id, user_id) WHERE ended_at IS NULL`
     — at most one running entry per (task, user).
   - RLS: `time_entries_admin_all` (is_admin) + `time_entries_team_all`
     (`exists(... tasks t where t.id = time_entries.task_id and app.is_assigned(t.client_id))`).
     **NO client policy** — a client has zero read/write at the DB layer.
   - RPCs (all `security definer set search_path=''`, each re-checks
     `is_admin() OR is_assigned(parent.client_id)`; stop/edit/delete also require
     `user_id = auth.uid()`):
     - `start_timer(p_task_id)` → inserts a running entry **and sets task.status='in_progress'**;
       raises if one already running.
     - `stop_timer(p_entry_id, p_complete default false)` → sets `ended_at=now()`;
       `p_complete=true` ALSO sets `task.status='done'`; **a plain stop leaves status untouched**.
     - `edit_time_entry(p_entry_id, p_started_at, p_ended_at)` → own entry; validates
       start required + end ≥ start.
     - `delete_time_entry(p_entry_id)` → own entry.
   - Grants: `authenticated` only; `revoke ... from public, anon`.

2. **Formatter** `lib/format.ts#formatDuration(totalSeconds, clock=false)`:
   - `clock=true` → `"H:MM:SS"` (the live ticking display).
   - `clock=false` → `"Hh Mm"` / `"Mm"` / `"Ss"` (a logged-entry / total summary).
   - **Do NOT add a new helper.**

---

## What to BUILD

### A. Server actions — `lib/actions/time.ts` (NEW, `"use server"`)
Staff-only, one thin wrapper per RPC. Mirror `lib/actions/tasks.ts`:
- `Result<T>` type, `requireClientAccess(clientId)` gate, `logAudit(...)`,
  `revalidateStaffTasks(clientId)` (= `revalidatePath('/clients/{id}/tasks')` +
  `revalidatePath('/clients/{id}')`).
- Each calls the RPC via the **RLS-scoped** `createClient()` (`supabase.rpc('start_timer', ...)`),
  NOT the admin client — the RPC's own `is_assigned` re-check + the table RLS are the
  authorization; `requireClientAccess` is the app-layer guard.
- Actions:
  - `startTimerAction(clientId, taskId)` → `rpc('start_timer', { p_task_id })`; audit `task.time_started`.
  - `stopTimerAction(clientId, entryId, complete)` → `rpc('stop_timer', { p_entry_id, p_complete })`;
    audit `task.time_stopped` (metadata `{ complete }`).
  - `editTimeEntryAction(clientId, entryId, startedAt, endedAt)` → `rpc('edit_time_entry', ...)`;
    audit `task.time_edited`.
  - `deleteTimeEntryAction(clientId, entryId)` → `rpc('delete_time_entry', { p_entry_id })`;
    audit `task.time_deleted`.
- All take `clientId` so `requireClientAccess` + revalidate target the right client.

### B. Audit constants — `lib/audit-actions.ts`
Add to the `Tasks` group: `"task.time_started"`, `"task.time_stopped"`,
`"task.time_edited"`, `"task.time_deleted"`. (`logAudit.action` is typed to `AuditAction`,
so an unlisted action is a compile error.)

### C. Type + fetch — `lib/tasks.ts` and the staff page
- In `lib/tasks.ts` add (mirroring `TaskChecklistItem`):
  ```ts
  export type TaskTimeEntry = {
    id: string;
    task_id: string;
    user_id: string;
    userName: string | null;   // resolved for display
    started_at: string;
    ended_at: string | null;   // null = running
  };
  ```
- In `app/(portal)/clients/[clientId]/tasks/page.tsx` (Server Component), after the
  existing `taskIds` line, mirror the `task_checklist_items` block: RLS-scoped fetch
  `from('time_entries').select('id, task_id, user_id, started_at, ended_at').in('task_id', taskIds)`,
  group into `Map<taskId, TaskTimeEntry[]>` (resolve `userName` from the already-built
  `nameById`/members), then attach `timeEntries` (all) + derive `runningEntry`
  (`entries.find(e => e.ended_at === null && e.user_id === current staff uid)`) onto each
  `StaffTask`. Add both fields to `StaffTask` in `components/tasks/staff-tasks-manager.tsx`
  and pass them through `<TaskDetailDialog ... timeEntries={t.timeEntries} runningEntry={t.runningEntry} />`.
  - The current staff uid: `requireClientAccess` returns the profile (`me.id`) — pass it
    down (or compute `runningEntry` as "this staff's open entry").

### D. Thread into the dialog — `components/tasks/task-detail-dialog.tsx`
- Import `TaskTimeEntry` from `@/lib/tasks`.
- Add props `timeEntries: TaskTimeEntry[]` and `runningEntry: TaskTimeEntry | null` to the
  destructured signature AND the props type literal (exactly how `checklist` was added).
- Render the new `<TaskTimeTracking .../>` inside the **existing empty `isStaff` fragment at
  lines 251-259** (the slot). These props are staff-only — do NOT add them to the client
  board/path.

### E. The component — `components/tasks/task-time-tracking.tsx` (NEW, `"use client"`)
Renders inside the staff slot. Props: `taskId`, `clientId`, `entries: TaskTimeEntry[]`,
`running: TaskTimeEntry | null`, plus `onStatusChange?: (s) => void` (optional — see status note).
- **Live clock**: a `useEffect` `setInterval(() => setNow(Date.now()), 1000)` (cleared on
  unmount), `elapsed = Math.floor((now - Date.parse(running.started_at))/1000)`, displayed via
  `formatDuration(elapsed, true)`. Gate the ticking behind `useReducedMotion()` (from
  `@/lib/motion`) — when reduced, render the value without animating; the interval is fine but
  skip any spin/count animation. There is no existing live-timer in the repo — this establishes it.
- **Controls**:
  - No running entry → a **Start** button → `startTimerAction(clientId, taskId)`.
  - Running entry → live `H:MM:SS` + **Stop** (`stopTimerAction(clientId, running.id, false)`)
    and **Stop & complete** (`stopTimerAction(clientId, running.id, true)`).
  - `router.refresh()` after each action; toast on `!res.ok`.
- **Past entries list**: each ended entry with `formatDuration(seconds)` + start time
  (`formatDateTime`) + `userName`; per-entry edit (→ `editTimeEntryAction`) and delete
  (→ `deleteTimeEntryAction`) for **own** entries only (the RPC enforces own-entry; the UI can
  show the controls only when `entry.user_id === currentUid`). Show a **total** =
  `formatDuration(sum of all ended durations + the live running elapsed)`.
- Use the same Card/row styling + `spring.snappy` motion as `TaskChecklist`.

### F. STATUS path (reuse, do not duplicate)
The RPCs already drive status server-side (`start`→in_progress, `stop_timer(true)`→done). After
each timer action call `router.refresh()` so the page re-fetches and the detail's status Select
(bound to `status`/`setStatus`, line 91/152) reseeds from the refreshed `task.status` (line 102's
reseed-on-task-change). **No second write path is needed** — the timer does NOT call
`staffUpdateTaskAction`; the RPC is the single status write. If you want the open dialog to reflect
the new status instantly without a refresh round-trip, optionally call `onStatusChange('in_progress')`
/ `onStatusChange('done')` (= `setStatus`) — but the RPC is still the source of truth.

---

## RLS TEST PLAN — add a `time_entries` group to `scripts/test-rls.ts`

Suite is dynamic (`results.length` denominator) — no constant to bump. Reuse existing fixtures:
`visTaskId` (premier, visible), `hidTaskId` (premier, hidden/internal), `xcTaskId` (pulse,
cross-client), `unTaskId` (unassigned client), and contexts `client`/`team`/`anon`/`admin`,
uids `clientUid`/`teamUid`. Add a `RLSTE%`/admin-seeded cleanup near line ~884 (the
`time_entries` rows also cascade when their `RLSTASK%` tasks are deleted via
`ON DELETE CASCADE`, so cleanup is mostly automatic — but delete explicit seeds you add).

Checks to add (mirror the `tasks` group structure):

**AS CLIENT (premier)** — group `time_entries`:
- client SELECT `time_entries` (any/own task) → **0 rows** (no client policy).
- client direct INSERT a `time_entries` row on `visTaskId` → **DENIED** (42501 / 0 rows).
- client direct UPDATE → DENIED.
- client `rpc('start_timer', { p_task_id: visTaskId })` → **RAISES** (RPC re-check: client is
  not admin/assigned).
- client `rpc('stop_timer', ...)` / `edit_time_entry` / `delete_time_entry` → **RAISE**.

**AS TEAM**:
- team→assigned (premier): `rpc('start_timer', {p_task_id: visTaskId})` → **ok**, returns a row,
  AND `tasks.status` for `visTaskId` is now `in_progress`. Then `rpc('stop_timer', {p_entry_id,
  p_complete:false})` → ok, `ended_at` set, status **still in_progress** (NOT done). Start again
  → `rpc('start_timer')` a second time while running → **RAISES** ("already running" — one-running
  enforced). Stop with `p_complete:true` → ok AND status `done`. SELECT premier's time_entries
  → **≥1 row**. (admin-clean the seeded rows after.)
- team→unassigned (unId): SELECT time_entries on `unTaskId` → **0**; `rpc('start_timer',
  {p_task_id: unTaskId})` → **RAISES**.
- (optional) own-entry: a second staff cannot `stop_timer`/`delete_time_entry` another staff's
  entry → RAISES ("only your own"). Use admin to seed an entry under `teamUid` then attempt with
  a different staff context if available; otherwise assert the own-entry branch via the RPC raise.

**AS ANON**:
- SELECT time_entries → 0; `rpc('start_timer', ...)` → DENIED/raises.

**Status-model assertions (the contract):**
- start → `tasks.status = in_progress` ✓
- plain stop → status unchanged (stays `in_progress`) ✓
- `stop_timer(complete=true)` → status `done` ✓
- one running per (user, task) — second `start_timer` while running RAISES ✓

---

## Client-NEVER-sees argument (defense in depth)

The staff timer can never reach a client; **five independent layers**:

1. **RLS** — `time_entries` has admin + team policies only, **NO client policy**. A client's
   SELECT returns 0 and any direct write is 42501. (Migration lines 35-43.)
2. **RPC re-check** — every timer RPC raises unless `is_admin() OR is_assigned(parent.client_id)`;
   a client is neither (`my_client_id()` ≠ assigned/admin), so all four RPCs raise for a client.
3. **Render gate** — the `<TaskTimeTracking>` lives strictly inside the `{isStaff && (...)}`
   fragment (task-detail-dialog.tsx 251-259). The client board renders `role="client"`
   (`components/tasks/client-task-board.tsx`), so `isStaff` is false → the slot never renders.
   There are exactly two `TaskDetailDialog` render sites (client: literal `role="client"`; staff:
   literal `role="staff"`) — no derived role, no third site.
4. **No data flow** — the client tasks page (`app/(portal)/tasks/page.tsx`, guarded
   `requireRole(["client"])`) selects only `tasks` columns + subtasks; it fetches **no**
   `time_entries`. The new fetch is added ONLY to the staff page. So even absent the render gate
   there is no time data on the client surface.
5. **Action gate** — `lib/actions/time.ts` is staff-only (`requireClientAccess`), and there is no
   client time action analogous to `tasks-client.ts`.

---

## Suite baseline

Current `scripts/test-rls.ts` printed total per the CLAUDE.md status line is the
project-options-era count (~247-ish; the denominator is computed dynamically as
`results.length`). The new `time_entries` group raises it automatically — **no hardcoded
constant to bump**; just add the `rec(...)` calls. (Implementer: run `npm run test:rls` and
record the new verbatim total in the phase report.)
