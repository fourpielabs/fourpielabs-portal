# Subtasks (task checklist) — Phase-4 design map

Lightweight, checklist-style **subtasks** that live under a parent `tasks` row, plus a
parent **progress bar** (`done/total`). They fill the **SUBTASKS (Phase 4)** slot in
`components/tasks/task-detail-dialog.tsx` (lines 240–244) and surface a thin progress bar
on both task cards (client board + staff manager).

This is a checklist, **not** a second task tree — items are just `{ title, is_done }` rows.
No status enum, no assignee, no due date, no source-message bridge, no notifications, no
nesting. The internal-thread boundary is inherited **entirely from the parent task** —
the new surface never reasons about thread types itself.

## Invariants (carried verbatim from `tasks` / `toggle_checklist_item`)

1. **No direct client write.** No client `INSERT/UPDATE/DELETE` policy on
   `task_checklist_items`. Clients write only through SECURITY DEFINER RPCs
   (the `toggle_checklist_item` / `create_task` / `update_task` precedent).
2. **Client write scope = own-client AND parent-task-visible.** Every client RPC re-reads
   the **parent** task server-side and applies the exact `tasks` gate:
   `v_task.client_id is distinct from v_client or not v_task.visible_to_client → raise`.
   An internal/staff-only or cross-client parent task is untouchable.
3. **Item READ visibility FOLLOWS THE PARENT TASK.** The child SELECT policy is keyed on
   the parent's `client_id` + `visible_to_client` via a correlated `EXISTS` into
   `public.tasks` — so a client never reads (or can act on) an item under an
   invisible/internal/other-client task. `visible_to_client` lives **only on the parent**;
   the child table has no visibility column, and the column is never selected into a
   client payload.
4. **No collision with onboarding.** The onboarding RPC is
   `public.toggle_checklist_item(item_id uuid)` on the unrelated `public.checklist_items`
   table. The new RPCs all carry the **`task_checklist`** infix and the new table is
   `public.task_checklist_items`. Confirmed clear (see Collision check).
5. **Do not touch** task status rules, task creation, the assignee circle, `update_task` /
   `update_task_status` (dropped), unrelated RLS, or any token/auth config.

## Collision check — CONFIRMED CLEAR

`grep -rin "task_checklist"` across `supabase/`, `scripts/`, `lib/`, `components/`, `app/`
returns **zero matches**. The only checklist RPC anywhere is
`public.toggle_checklist_item(item_id uuid)` (no `task_` infix), defined in
`supabase/migrations/20260610010005_toggle_checklist_item.sql` against `public.checklist_items`
(the onboarding table). All four new names are free:

| New name | Args | Purpose |
| --- | --- | --- |
| `public.add_task_checklist_item` | `(uuid task_id, text title)` | client adds an item to their own visible task |
| `public.toggle_task_checklist_item` | `(uuid item_id)` | client flips `is_done` |
| `public.edit_task_checklist_item` | `(uuid item_id, text title)` | client renames an item |
| `public.delete_task_checklist_item` | `(uuid item_id)` | client deletes an item |

The new table `public.task_checklist_items` likewise does not exist (no `subtask*` /
`task_item*` / `task_checklist*` table in `supabase/migrations`).

## Table: `public.task_checklist_items`

Modeled on `public.checklist_items` (the only existing per-parent `done/total` precedent),
but keyed on `task_id` (not `client_id`/`kind`) and with **no `visible_to_client` column**
(visibility is inherited from the parent task — invariant 3). `client_id` is **denormalized
NOT NULL** so the child RLS/`EXISTS` and audit are cheap and so a row can never be silently
re-parented across clients; it is kept consistent with the parent by the write paths
(staff direct write stamps it; the client `add` RPC copies it from the parent).

```
id          uuid pk default gen_random_uuid()
task_id     uuid not null references public.tasks (id) on delete cascade   -- parent
client_id   uuid not null references public.clients (id) on delete cascade -- denormalized = parent's
title       text not null
sort_order  int  not null default 0
is_done     boolean not null default false
done_by     uuid references public.profiles (id) on delete set null
done_at     timestamptz
created_by  uuid references public.profiles (id) on delete set null
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()
```

- Index `idx_task_checklist_items_task on (task_id)` for the `.in("task_id", ...)` fetch.
- `before update` trigger → `public.set_updated_at()` (the table-wide convention).
- `on delete cascade` from `tasks` → deleting a task removes its items automatically.

## RLS — parent-visible

`is_admin()` / `is_assigned()` are `exists()`-based (never NULL → no `coalesce` needed in a
USING clause — this is **not** the `language sql` boolean-helper caveat, which only bites
when a bare helper flows up to `if not <fn>` in a plpgsql caller). In the client branch
`t.client_id = app.my_client_id()` is NULL for staff (whose `my_client_id()` is null), so the
client branch self-excludes staff — mirroring `tasks_client_select` exactly. One combined
SELECT policy keyed on the parent, **no** client write policy:

```sql
create policy "task_checklist_items_select" on public.task_checklist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and (
             app.is_admin()
          or app.is_assigned(t.client_id)
          or (t.client_id = app.my_client_id() and t.visible_to_client)
        )
    )
  );
```

**Staff write path.** Staff write items via direct table writes — but the SELECT-only
policy above does not grant `INSERT/UPDATE/DELETE`. To keep staff symmetric with how they
manage `tasks` (direct table writes under the `tasks_admin_all` / `tasks_team_all`
*for-all* policies, no RPC), the migration adds **two staff for-all policies** gated on the
parent (admin all / team assigned), mirroring `tasks` one-for-one:

```sql
create policy "task_checklist_items_admin_all" on public.task_checklist_items
  for all to authenticated
  using  (exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and app.is_admin()))
  with check (exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and app.is_admin()));

create policy "task_checklist_items_team_all" on public.task_checklist_items
  for all to authenticated
  using  (exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and app.is_assigned(t.client_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and app.is_assigned(t.client_id)));
```

This gives staff the *for-all* write capability they already have on `tasks` (so staff
write via direct user-scoped RLS table writes in `lib/actions/tasks.ts`, no new RPC) while
**clients still have no write policy** — they remain RPC-only. The combined client-readable
`task_checklist_items_select` above adds the client SELECT branch on top. (Equivalently, the
admin/team for-all policies cover staff SELECT, and the client branch could be split into a
client-only SELECT policy; both shapes are RLS-identical. The combined-SELECT + two
staff-FOR-ALL split is the recommended, minimal-policy form.)

## RPCs (client write path) — 4 SECURITY DEFINER functions

All four follow the house convention verbatim: `language plpgsql security definer set
search_path = ''` (everything schema-qualified, `(select auth.uid())` subselect-wrapped),
the auth + `my_client_id()` null guards, a not-found guard, then the **parent gate** from
`update_task` (own-client AND `visible_to_client`), then mutate, then `return`. Footer is the
two-line `revoke ... from public, anon;` / `grant ... to authenticated;` with the full
arg-type signature.

- **`add_task_checklist_item(p_task_id uuid, p_title text)`** — gate the parent directly off
  `p_task_id`; require non-empty `btrim(p_title)`; insert with `client_id` copied from the
  parent task, `sort_order = coalesce(max+1, 0)` within the task, `created_by = auth.uid()`.
- **`toggle_task_checklist_item(p_item_id uuid)`** — look up the item, then its parent task,
  apply the parent gate; flip `is_done` (and set/clear `done_by`/`done_at` exactly like
  `toggle_checklist_item`).
- **`edit_task_checklist_item(p_item_id uuid, p_title text)`** — same item→parent gate;
  require non-empty title; set `title = btrim(p_title)`.
- **`delete_task_checklist_item(p_item_id uuid)`** — same item→parent gate; delete the row;
  returns `void`.

Each edit/toggle/delete: (a) `auth.uid()` null-guard, (b) `v_client = app.my_client_id()`
null-guard, (c) SELECT the item by `p_item_id` (raise 'not found'), (d) SELECT the **parent**
task by `v_item.task_id` (raise 'not found'), (e) parent gate
`if v_task.client_id is distinct from v_client or not v_task.visible_to_client then raise`,
(f) mutate scoped to the item, (g) return. `add` gates the parent directly off `p_task_id`.

(See `migrationSql` in the structured output / below for the verbatim SQL.)

## Data flow — one query, then card progress + detail items

### 1. One RLS-scoped fetch per page, grouped by `task_id`

After each page fetches its task list and knows the ids, fetch all child items in **one**
round-trip on the **same user-scoped RLS client** (so the parent-visible policy auto-enforces
client visibility — a client never receives an item under an invisible/cross-client task) and
group in JS. No view, no N+1.

**Client page** `app/(portal)/tasks/page.tsx` — sequential to the task fetch (needs ids):

```ts
const taskIds = (tasks ?? []).map((t) => t.id);
const { data: items } = taskIds.length
  ? await supabase
      .from("task_checklist_items")
      .select("id, task_id, title, is_done") // NO visible_to_client column exists; RLS gates the read
      .in("task_id", taskIds)
      .order("sort_order")
  : { data: [] };

const byTask = new Map<string, { id: string; title: string; is_done: boolean }[]>();
for (const it of items ?? []) {
  const arr = byTask.get(it.task_id) ?? [];
  arr.push({ id: it.id, title: it.title, is_done: it.is_done });
  byTask.set(it.task_id, arr);
}
// then on each list row: subtasks: byTask.get(t.id) ?? []
```

**Staff page** `app/(portal)/clients/[clientId]/tasks/page.tsx` — identical, same select
(staff RLS sees items under internal tasks too — correct for staff). Keep this on the
**RLS client**, not the service-role admin client (the admin client is used only for
`thread_type` resolution).

### 2. Thread progress onto the card rows

- `ClientTaskRow` (`client-task-board.tsx` L19–31) and `StaffTask` (`staff-tasks-manager.tsx`
  L37–42) each gain a `subtasks: { id; title; is_done }[]` field, populated in each page's
  `.map(...)` from `byTask.get(t.id) ?? []`.
- The card computes `done = subtasks.filter(s => s.is_done).length` and
  `total = subtasks.length` inline and renders the bar only when `total > 0`.
- The staff manager keeps its **optimistic local copy** (`useState(initialTasks)` +
  render-time `prevTasks` re-sync, L57–64). The new `subtasks` field rides along inside the
  `StaffTask` objects automatically; `changeStatus`/`deleteTask` only touch
  `status`/membership, so they preserve it. **Do NOT convert to an effect.**

### 3. Items into the detail dialog

`DetailTask` (`task-detail-dialog.tsx` L39–53) gains
`subtasks?: { id: string; title: string; is_done: boolean }[]`. The detail is opened from
the same in-memory list both boards already hold (`tasks.find(t => t.id === openId)`), so the
items pass straight through page → board row → `openTask` → the dialog. The SUBTASKS slot
(L240–244) renders the list there. After any write the detail mirrors the existing `save()`
path: `router.refresh()` re-runs the page query and re-paints the card bar.

## SUBTASKS-slot UI plan

A small `<TaskChecklist>` (`components/tasks/task-checklist.tsx`, `"use client"`) rendered in
the slot for **both** roles, props `{ taskId, items, role }`. It mirrors
`components/client/client-checklist.tsx`'s optimistic-toggle + progress patterns and reuses
the app's `Button`, `Input`, `Check`/`Plus`/`Trash2`/`Pencil` lucide icons, and `toast`.

- **List.** Each row = the round checkbox button (filled `bg-amber-600` circle + `Check`
  icon with the `tickPop` animation when done, else a `border-[1.5px] border-border-strong`
  empty circle), the `title` (`flex-1`, `line-through text-ink-3` when done), and — staff
  only — inline rename (`Pencil` → swap title to an `Input`) + `Trash2` delete (confirm via
  `AlertDialog`, matching the manager's delete). Clients see toggle only (rename/delete are
  staff affordances; clients edit via the RPCs if we expose them, but v1 ships client
  **toggle + add**, staff **toggle + add + rename + delete**).
- **Add.** A bottom "Add subtask" row: a small `Input` + `Plus` submit (Enter to add).
  Client → `add_task_checklist_item` RPC (browser client) wrapped in a new
  `lib/actions/tasks-client.ts` action; staff → direct table insert in a new
  `lib/actions/tasks.ts` action (`requireClientAccess` + `.eq("client_id", clientId)` +
  `logAudit` + `revalidatePath`).
- **Optimistic toggle.** Exactly the `client-checklist.tsx` shape: local
  `useState(items)` + `prevItems` render-time re-sync; `flip(id)` updates local state
  **before** the call; on error re-`flip` + `toast.error`. Client toggle calls
  `supabase.rpc("toggle_task_checklist_item", { p_item_id: id })`; staff toggle calls a
  `staffToggleTaskChecklistItemAction`.
- **Empty state.** When `items.length === 0`: a quiet "No subtasks — add one to break this
  down." above the add row (no full `EmptyState` card inside the dialog).
- **Phase-3 motion.** Reuse the established tokens — `tickPop` on check
  (`var(--spring-tick)`), the `transition-[width] duration-[250ms] ease-out` progress fill,
  and `motion-micro`/`StaggerItem` lift on rows if added to the dialog list. No new motion
  primitives.

## Progress indicators

`done = items.filter(s => s.is_done).length`, `total = items.length`,
`pct = total ? Math.round((done/total)*100) : 0`.

- **Detail (in the slot, above the list):** the `client-checklist.tsx` bar verbatim — a
  `{done} of {total} done` label (`text-[13px] font-semibold text-ink-2`) over an
  `h-1.5 overflow-hidden rounded-full bg-surface-2` track with an inner
  `h-full rounded-full bg-amber-600 transition-[width] duration-[250ms] ease-out` fill at
  `width: {pct}%`.
- **Both cards (client board + staff manager meta row):** a compact variant — a
  `tabular-nums` `{done}/{total}` count next to a short fixed-width track (e.g.
  `w-16 h-1.5 rounded-full bg-surface-2` with the same amber fill), shown only when
  `total > 0`. Client card: append to the meta `<div>` at L92–103 after `due_date`/`from a
  message`. Staff row: the meta `<div>` at L143–157. Use a `ListChecks`/`CheckSquare` icon
  + the count to read as "subtask progress" at a glance.

## RLS test plan (`scripts/test-rls.ts`, new group `"task_checklist"`)

The suite has **no hardcoded total** — it prints `${results.length - failed.length}/${results.length}`
(L799), so new `rec(...)` calls auto-grow the count. **Current baseline: 186** (last recorded
`test:rls` run; the migration + tests below take it to **~205**, +19 checks). New checks slot
into the existing context blocks, reusing the seeded fixtures:

- `visTaskId` — premier, `visible_to_client: true` (own + VISIBLE) → allowed client paths +
  parent of a visible item.
- `hidTaskId` — premier, `visible_to_client: false` (own but INVISIBLE) → client DENIED.
- `xcTaskId` — pulse, `visible_to_client: true` (CROSS-CLIENT) → client DENIED.
- `client` / `clientUid` (demo-client, premier), `team` (demo-team, assigned premier+pulse,
  not `unId`), `anon`, `admin` (service-role, seeds + ground-truth read-back).

Seed (service-role, titles `RLSTASKCL%`, cleaned up alongside `RLSTASK%`): one item under
`visTaskId` (`RLSTASKCL-vis`), one under `hidTaskId` (`RLSTASKCL-hid`), one under `xcTaskId`
(`RLSTASKCL-xc`).

**Client block** (~L508–564, group `"task_checklist"`):
- Read scoped to parent visibility: `client.from("task_checklist_items").select("id, task_id, title")`
  → contains the item under `visTaskId`, NOT the ones under `hidTaskId`/`xcTaskId`.
- `add_task_checklist_item(p_task_id: visTaskId, ...)` allowed (own + visible).
- `toggle_task_checklist_item` / `edit_task_checklist_item` / `delete_task_checklist_item` on
  the `visTaskId` item allowed.
- Direct `insert` / `update` / `delete` on `task_checklist_items` DENIED (`42501` or 0 rows);
  clean up any leaked row via `admin`.
- `add` on `hidTaskId` (INVISIBLE) RAISES; `add` on `xcTaskId` (CROSS-CLIENT) RAISES.
- `toggle`/`edit`/`delete` on the `hidTaskId` item RAISES; same on the `xcTaskId` item RAISES.
- No-escalation read-back: after a denied write, `admin` re-reads the protected item unchanged.

**Team block** (~L665–682, assigned premier):
- `team.from("task_checklist_items").insert/update/delete` under a premier task succeeds
  (the staff for-all policy).
- Team→unassigned (`unId`): read items 0 + direct write denied.

**Anon block** (~L691–734):
- `task_checklist_items` read 0; direct write denied; each of the 4 RPCs denied.

Run: `npm run test:rls`. **Precondition: the migration must be pushed first** (the table +
4 RPCs must exist before these checks can pass).

## Files touched

- **New:** `supabase/migrations/20260618xxxxxx_task_checklist_5_subtasks.sql`,
  `components/tasks/task-checklist.tsx`.
- **Edit:** `components/tasks/task-detail-dialog.tsx` (slot + `DetailTask.subtasks`),
  `components/tasks/client-task-board.tsx` (`ClientTaskRow.subtasks` + card bar),
  `components/tasks/staff-tasks-manager.tsx` (`StaffTask.subtasks` + row bar),
  `app/(portal)/tasks/page.tsx` + `app/(portal)/clients/[clientId]/tasks/page.tsx` (the
  `.in("task_id", ...)` fetch + grouping), `lib/actions/tasks.ts` (staff add/toggle/edit/
  delete actions), `lib/actions/tasks-client.ts` (client add/toggle RPC wrappers),
  `scripts/test-rls.ts` (the `task_checklist` group).
