# Tasks — Permission Model Audit (status lock)

**Goal:** Lock task **status** changes to STAFF only. Clients must keep create +
edit-own-title/description but must **not** be able to change a task's status —
mirroring the already-shipped project-status fix
(`supabase/migrations/20260617183715_lock_project_status_to_staff.sql`) that
dropped the `p_status` param from the client `update_project` RPC and removed the
client status UI control.

This doc maps the current (pre-fix) state and the minimal fix.

---

## 1. `public.tasks` table — full schema

Defined in `supabase/migrations/20260616123701_tasks_5a.sql` (Phase 5a). It is the
**only** migration that defines this table or its RPCs (repo-wide grep for
`create_task` / `update_task_status` returns just this file; no later migration
alters them).

| # | Column | Type | Null? | Default | Notes / constraints |
|---|--------|------|-------|---------|---------------------|
| 1 | `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| 2 | `client_id` | `uuid` | NOT NULL | — | FK → `public.clients(id)` ON DELETE CASCADE |
| 3 | `title` | `text` | NOT NULL | — | |
| 4 | `description` | `text` | nullable | — | |
| 5 | `status` | `public.task_status` | NOT NULL | `'todo'` | **the field to lock** |
| 6 | `assignee_id` | `uuid` | nullable | — | FK → `public.profiles(id)` ON DELETE SET NULL (staff OR client) |
| 7 | `due_date` | `date` | nullable | — | |
| 8 | `visible_to_client` | `boolean` | NOT NULL | `true` | internal-thread boundary gate; only internal-message-sourced tasks set it `false` |
| 9 | `source_message_id` | `uuid` | nullable | — | FK → `public.messages(id)` ON DELETE SET NULL (set when created from chat) |
| 10 | `created_by` | `uuid` | nullable | — | FK → `public.profiles(id)` ON DELETE SET NULL |
| 11 | `created_at` | `timestamptz` | NOT NULL | `now()` | |
| 12 | `updated_at` | `timestamptz` | NOT NULL | `now()` | maintained by trigger `trg_tasks_updated_at` → `public.set_updated_at()` |

No named CHECK constraints. Constraints = the PK, three FKs (clients cascade,
profiles ×2 set null, messages set null), four NOT NULLs. Indexes:
`idx_tasks_client(client_id)`, `idx_tasks_assignee(assignee_id)`.

### `task_status` enum — exactly three values, declared order

```sql
create type public.task_status as enum ('todo', 'in_progress', 'done');
```

`todo` · `in_progress` · `done`. The `status` column defaults to `'todo'`.

---

## 2. RLS policies on `public.tasks`

RLS enabled. Exactly **three** policies — no client write policy exists:

```sql
alter table public.tasks enable row level security;

create policy "tasks_admin_all" on public.tasks
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy "tasks_team_all" on public.tasks
  for all to authenticated
  using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));

create policy "tasks_client_select" on public.tasks
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);
-- NO client INSERT/UPDATE/DELETE policy — clients write only via the RPCs below.
```

A client passes neither `app.is_admin()` nor `app.is_assigned()`, so the only
client-applicable policy is `tasks_client_select` (read-only, own client +
`visible_to_client`). **There is no client INSERT/UPDATE/DELETE/FOR-ALL policy** —
a direct table UPDATE from a client is RLS-denied (42501). The client write path
is RPC-only, matching the `toggle_checklist_item` / `create_project` /
`update_project` precedent.

---

## 3. Client write RPCs — what a client can set TODAY

Both are `language plpgsql security definer set search_path = ''`, return
`public.tasks`, and grant EXECUTE only to `authenticated` (revoked from
`public, anon`).

### `create_task(p_title, p_description, p_assignee, p_due_date, p_source_message_id)`

- Caller does **NOT** choose status — the INSERT **hard-codes `status = 'todo'`**
  (there is no `p_status` param) and **hard-codes `visible_to_client = true`**.
- Derives `client_id = app.my_client_id()` and `created_by = auth.uid()` from the
  caller — never from input, so a client cannot target another client.
- Validates: authenticated + caller is a client + non-empty title; assignee (if
  given) must be in the client's CIRCLE (active profile that is a user of this
  client OR an admin OR an assigned team member) — never arbitrary; source message
  (if given) must be one of THIS client's own `thread_type = 'client_shared'`
  messages (internal-thread boundary at the source).

So at **create time** a client sets: `title`, `description`, `assignee_id`
(circle-gated), `due_date`, `source_message_id` (own shared thread). Status is
forced to `todo`.

### `update_task_status(p_task_id, p_status)` — THE STATUS PATH

```sql
-- supabase/migrations/20260616123701_tasks_5a.sql (lines 109-134)
create or replace function public.update_task_status(
  p_task_id uuid,
  p_status public.task_status
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_row    public.tasks;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can update tasks here'; end if;

  select * into v_row from public.tasks where id = p_task_id;
  if not found then raise exception 'Task not found'; end if;
  if v_row.client_id is distinct from v_client or not v_row.visible_to_client then
    raise exception 'Not authorized for this task';
  end if;

  update public.tasks set status = p_status where id = p_task_id returning * into v_row;
  return v_row;
end;
$$;
```

This is the **only** RPC that lets a client change status. It writes
`status = p_status` **directly from the caller-supplied param** — the client picks
**any** of the three enum values (`todo | in_progress | done`). The only gate is
own-client + `visible_to_client = true` (so internal/staff-only tasks are
invisible and untouchable, and cross-client targets RAISE). No other column is
mutated by this RPC.

**There is no client edit-title/description RPC or action.** A client sets
title/description only at creation. After creation, the **only** client-mutable
field is `status` — via `update_task_status`.

---

## 4. PLAIN ANSWER — can a client set arbitrary status on their own task today?

**YES.** A client can set an **arbitrary** status (`todo`, `in_progress`, or
`done`) on **their own client's `visible_to_client = true` task** today.

- **Via RPC:** `public.update_task_status(p_task_id, p_status)` — writes
  `status = p_status` straight from the param. This is the live path.
- **Via direct table UPDATE:** **NO.** RLS denies it (no client UPDATE policy;
  42501). The RPC is the sole route.

UI route: `lib/actions/tasks-client.ts#setTaskStatusAction(taskId, status)` →
`supabase.rpc("update_task_status", …)`, driven by a `<Select>` per task card.

---

## 5. Task detail view?

**No.** There is no per-task route, page, or detail dialog. Tasks render only as
cards in the board grid (`components/tasks/client-task-board.tsx`, lines ~94-140)
showing title, status chip, assignee, due date, an optional "from a message" link,
and inline description. The only dialog is `ClientTaskDialog` — a **create-only**
"Add a task" form (no `taskId` prop, always calls `createTaskAction`). Clients have
**no way to open/edit an existing task** beyond the inline status `<Select>`.

The status control:

```tsx
// components/tasks/client-task-board.tsx (lines 121-135)
<Select
  value={t.status}
  onValueChange={(s) => setStatus(t.id, s as ClientTaskRow["status"])}
>
  <SelectTrigger size="sm" className="w-[8.5rem] shrink-0" aria-label={`Status for ${t.title}`}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {TASK_STATUSES.map((o) => (
      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

`setStatus` (lines 57-65) optimistically updates local state then calls
`setTaskStatusAction`. A read-only `StatusChip kind="task"` (line 102) also shows
the status as display-only next to the title.

---

## 6. How staff set status (the fix must NOT touch this)

Staff use **DIRECT table UPDATEs** on `tasks` (no RPC), under the
`tasks_admin_all` / `tasks_team_all` for-all policies, via three actions in
`lib/actions/tasks.ts`, each gated by `requireClientAccess(clientId)` and scoped
`.eq("client_id", clientId)`:

- `staffSetTaskStatusAction(clientId, id, status)` — status-only direct UPDATE.
- `staffUpdateTaskAction(clientId, id, input)` — full edit incl. status.
- `staffCreateTaskAction(clientId, input)` — direct INSERT.

UI: `components/tasks/staff-tasks-manager.tsx` (per-row status `<Select>` →
`changeStatus` → `staffSetTaskStatusAction`) and
`components/tasks/task-form-dialog.tsx` (RHF+Zod `taskStaffSchema`, status `<Select>`
Controller → `staffCreate/UpdateTaskAction`).

**Provable isolation:** the staff path shares no code, no action, and no RPC with
the client path. Staff never call `update_task_status` / `create_task`; clients
never call the staff actions. A fix confined to the client RPC + client `/tasks`
UI cannot affect staff status control.

---

## 7. Recommended minimal fix (mirrors the project-status precedent)

The project fix dropped `p_status` from `update_project` and removed the client
status UI. Tasks are **simpler** because there is no client edit-title/description
path to preserve — the entire `update_task_status` RPC exists **only** to let a
client change status. So the minimal fix is to remove that capability outright.

**A. Database (new migration `*_lock_task_status_to_staff.sql`):**

- `drop function if exists public.update_task_status(uuid, public.task_status);`
  Do **not** recreate it (unlike `update_project`, which had to be recreated for
  the title/description edit — tasks have no other client edit, so a recreate is
  pure dead weight). After the drop, a client has **zero** status write path:
  `tasks_client_select` is read-only and no UPDATE policy exists.
- Leave `create_task` (status hard-coded `'todo'`) and the three table policies
  unchanged.

> Note vs. projects: there, status had to be *preserved* on a client edit by
> dropping it from the SET clause. Here there is no surviving client UPDATE at all,
> so dropping the function is sufficient and strictly cleaner.

**B. Client action (`lib/actions/tasks-client.ts`):**

- Delete `setTaskStatusAction` (lines 71-93) and its `TaskStatus` type / unused
  imports. Keep `createTaskAction`.

**C. Client UI (`components/tasks/client-task-board.tsx`):**

- Remove the status `<Select>` (lines 121-135) and the `setStatus` handler
  (lines 57-65). Keep the read-only `StatusChip kind="task"` (line 102) so the
  client still **sees** status, set by staff. (Same shape as the project board,
  which shows status read-only after its fix.)

**D. Tests (`scripts/test-rls.ts`):** in the `tasks` group, the three
`update_task_status` checks must flip from "RPC succeeds/raises on a target" to
"the RPC no longer exists / is denied to a client":

- Replace "update_task_status own visible task allowed" (currently passing) with a
  check that a client calling `update_task_status` is **denied** (function dropped
  → error). The CROSS-CLIENT and INVISIBLE checks already expect an error and stay
  green by definition. Update the `anon` group's `update_task_status RPC denied`
  check similarly (it stays an error). Net: the suite total stays the same count of
  checks; the semantics of the three client status checks change.

This confines the change to the client RPC + client action + client board + RLS
tests. Staff actions, the staff `<Select>`/dialog, the for-all policies, and
`create_task` are untouched.

---

## 8. Test baseline (pre-fix)

`scripts/test-rls.ts` documented baseline = **186** checks (CLAUDE.md Phase 5d;
the printed denominator is computed dynamically from `results.length`, not a
literal). The `tasks` group (lines 506-542) has 11 client checks; staff/anon groups
add task assertions ("team→assigned", "team→unassigned", "anon"). The three
`update_task_status` checks are the ones whose semantics change under the fix.

---

## 9. Resolution — APPLIED (2026-06-18, `ui-overhaul/task-status-lock`)

Migration `20260617233418_lock_task_status_to_staff.sql`:
`drop function if exists public.update_task_status(uuid, public.task_status);`
(not recreated). Deleted `setTaskStatusAction`; removed the client board status
`<Select>` + handler + now-unused state/imports (read-only `StatusChip` kept);
updated the `tasks` RLS checks.

**The plain answer is now NO.** A client has zero status-write path: the RPC is gone
(`pg_proc` → 0 rows) and `tasks` has no client INSERT/UPDATE policy (only
`tasks_client_select`, read-only), so a direct `UPDATE … SET status` is 42501-denied.
`create_task` is unchanged (hard-codes `'todo'`), so clients still CREATE. Staff
status control is untouched (direct table writes under `tasks_admin_all` /
`tasks_team_all`).

**Verified:** live `pg_proc`/policy check · `npm run test:rls` **214/214** (the real
total — the "186" above was a stale CLAUDE.md reference) · `tsc` + build green ·
client `/tasks` console-clean with the status control gone, read-only chip present ·
a 6-skeptic adversarial workflow found **0 holes** (RPC · direct-UPDATE · create_task
· UI-leftover · staff-regression · test-weakness all clean).
