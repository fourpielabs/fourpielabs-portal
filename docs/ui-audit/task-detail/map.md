# Task Detail View — Surface Map & Design (Phase 2)

A Phase-2 **task detail** view: a host surface for an individual task that will later
hold subtasks + a staff timer. This doc maps the current client + staff task surfaces,
decides **modal vs route**, specifies the **deep-link** mechanism, designs the
**`update_task` RPC** (client title/description edit), gives the **client vs staff
field/control matrix**, and gives a hard **internal-thread-boundary** analysis for the
task-created system message.

## Invariants (non-negotiable)

1. **Clients write only via SECURITY DEFINER RPCs**, own-client scope. There is **no
   direct client INSERT/UPDATE policy** on `tasks` — only `tasks_client_select` (read,
   gated `client_id = app.my_client_id() and visible_to_client`).
2. **Task STATUS is STAFF-ONLY and already locked.** The client status RPC
   `update_task_status(uuid, task_status)` was **DROPPED** by migration
   `20260617233418_lock_task_status_to_staff.sql`. The client detail must expose **NO
   status control** — status renders read-only via `StatusChip` only.
3. **Respect `visible_to_client` on every client read.** It is an RLS gate, never
   selected into a client-facing payload (it is absent from `ClientTaskRow`).
4. **The internal-thread boundary must hold** for any task-created chat message.

---

## 1. Current task surfaces

### 1a. Client surface

| Aspect | Today |
| --- | --- |
| Route | `app/(portal)/tasks/page.tsx` — top-level `/tasks` (NO `clientId` in path; RLS scopes to own client). Nav in `components/shell/client-shell.tsx`. |
| Guard | `requireRole(["client"])`, then a user-scoped RLS server client. |
| Fetch | `supabase.from("tasks").select("id, title, description, status, assignee_id, due_date, source_message_id").order("created_at", desc)`. **No explicit `.eq("visible_to_client", true)`** — the gate is RLS-only; staff-only tasks are *invisible rows*, not filtered rows. Assignee circle via `getAssignableMembers(profile.client_id)` (service-role: own users ∪ admins ∪ assigned team). |
| Render | `components/tasks/client-task-board.tsx`. `PageContainer` + `PageHeader`. `Stagger` `<ul>` (`lg:grid-cols-2`) of **inert** `Card > CardContent` rows: title + read-only `StatusChip kind="task"`, meta row (assignee, `Due …`, "from a message" `Link href="/messages"`), description. The Card has **no `onClick`/`Link`/`role`** — clicking does nothing. |
| Write | `createTaskAction` ONLY (`lib/actions/tasks-client.ts`) → `create_task` RPC. **No** update/delete/status export. New tasks default `status='todo'` (hard-coded in the RPC). |
| Detail today | **NONE.** No `/tasks/[id]`, no detail dialog. The card is the clean click-to-open insertion point (`client-task-board.tsx` line 68). |

`ClientTaskRow` shape (note: **no `visible_to_client` field**):
```ts
{ id; title; description: string|null; status: "todo"|"in_progress"|"done";
  assignee_id: string|null; assigneeName: string|null;
  due_date: string|null; source_message_id: string|null }
```

### 1b. Staff surface

| Aspect | Today |
| --- | --- |
| Route | `app/(portal)/clients/[clientId]/tasks/page.tsx` — `/clients/[clientId]/tasks`. |
| Guard | `await requireClientAccess(clientId)` (admin-or-assigned). |
| Fetch | Same select **plus `visible_to_client`** (`.eq("client_id", clientId)`, RLS-scoped — staff see ALL tasks incl. internal `visible_to_client=false`). `getAssignableMembers(clientId)`. |
| Render | `components/tasks/staff-tasks-manager.tsx`. Optimistic local copy (`useState(initialTasks)` + render-time `prevTasks` re-sync — NOT an effect; **any reuse must preserve this re-sync**). Flat `<li>` rows (`rounded-2xl border border-border bg-surface p-4 shadow-e1 hover:shadow-e2`): title, `StatusChip`, amber **"Internal"** `Lock` badge when `!visible_to_client`, assignee, due, "from a message" link, description. |
| Controls | INLINE status `<Select>` → `staffSetTaskStatusAction` (optimistic + rollback); DELETE `AlertDialog` → `staffDeleteTaskAction`; EDIT/NEW `TaskFormDialog`. |
| Dialog | `components/tasks/task-form-dialog.tsx` = **create + edit** (`isEdit = Boolean(task)`). The ONLY place title/description/assignee/status/due_date/visible_to_client are editable. |
| Write actions | `lib/actions/tasks.ts`: `staffCreate/Update/SetStatus/DeleteTaskAction`. All `requireClientAccess` → user-scoped RLS write → `.eq("client_id", clientId)` → `logAudit` → `revalidateStaffTasks` (revalidates `/clients/${clientId}/tasks` AND `/clients/${clientId}`). Circle re-validated via `isCircleMember`; `resolveSource` re-reads the source message's REAL `thread_type` (un-spoofable) and forces `visible_to_client=false` for an internal source. |

**Reuse note:** the detail view should reuse `TaskFormDialog` and the four `staff*Action`
functions as-is (keyed by `clientId + id`, self-contained). Do NOT move field editing out
of the dialog. If status/delete render outside `StaffTasksManager`, replicate the
optimistic-local-copy + `prevTasks` re-sync, or call the actions and `router.refresh()`.

---

## 2. Modal vs Route — decision: **MODAL** (`?task={id}` on the existing list pages)

**Recommendation: modal.** Open the detail as a Radix `Dialog` driven by a `?task={id}`
query param that EACH list page reads from `searchParams` and resolves against its own,
already-RLS-scoped task list. Do **not** build `/tasks/[id]` + `/clients/[clientId]/tasks/[id]`
routes.

Concrete reasons (tied to existing UX, deep-link, and hosting future slots):

1. **It solves the client/staff URL split for a shared message.** Client and staff have
   *entirely separate namespaces* (`/tasks` vs `/clients/[clientId]/tasks`) but a
   `client_shared` message/task is visible to BOTH. A single static `/tasks/{id}` href
   404s/guards-out staff; `/clients/{clientId}/tasks/{id}` redirects a client (clients are
   redirected off `/clients`). A relative `?task={id}` resolves on whichever list page the
   viewer is already on — same link works for both audiences without encoding audience.

2. **Matches the established precedent.** `?tab=internal` is already the app's only
   query-param deep-link idiom (staff messages page reads it via `searchParams`).
   `?task={id}` is the identical mechanism. And **every** task detail/edit here is already a
   `Dialog` (`TaskFormDialog`, `ClientTaskDialog`, `TaskCreateDialog`) — there are **no**
   detail ROUTES anywhere in tasks. A route would be a new pattern; a modal is the grain.

3. **No new RLS/route-guard work, no list duplication, and visibility is auto-enforced.**
   The list pages already fetch the RLS-scoped row. The modal reads it from that same list;
   a `?task` id not in the list is a natural no-op ("not found") — so a client physically
   **cannot** open an internal/invisible task because that row never reaches their list (the
   `visible_to_client` RLS gate does the work for free). Two new dynamic routes would each
   re-run `requireRole`/`requireClientAccess`, re-fetch, and re-apply the `visible_to_client`
   gate — duplicated surface, duplicated risk.

4. **Best host for future slots (subtasks + staff timer).** A modal sits *over* the live,
   already-loaded, RLS-scoped board and inherits its optimistic state. Subtasks/timer mutate
   in place and reflect on the board behind it via `router.refresh()`; a separate route would
   re-fetch the whole world and lose the board's optimistic context. Motion/reduced-motion
   come free from `DialogContent`'s built-in `data-open:animate-in … zoom-in-95` CSS keyframes
   + the central `MotionProvider` (`MotionConfig reducedMotion="user"`).

**Caveat:** `markThreadViewedAction` clears bell rows by **exact `link` match**. Tasks don't
touch that today, but if a future task notification deep-links to a task, store the
audience-appropriate `?task={id}` link **per recipient** (the notify recipient list is
already split client-vs-staff) — never one shared URL.

---

## 3. Deep-link mechanism (exact URLs/params)

Three distinct links. **No per-message anchor and no per-task route exist today** — only
thread-level targets are supported (the `Conversation` has no per-message DOM `id`/hash;
only `bottomRef.scrollIntoView`).

### (a) Detail open — `?task={id}` modal trigger
- **Client:** `/tasks?task={id}` → `app/(portal)/tasks/page.tsx` reads
  `searchParams.task`, finds the row in its RLS-scoped list, auto-opens the client detail
  dialog. Not in list → no-op (the visibility gate).
- **Staff:** `/clients/{clientId}/tasks?task={id}` → same, against the staff list.
- Trigger from the board: clicking a task `Card`/`<li>` sets the param (client-side
  `router.push`/`Link` appending `?task={t.id}`); the detail reads `t.id`. StatusChip stays
  read-only for clients regardless.

### (b) Detail's "Created from a message" → source thread (thread-level only)
The task row carries `source_message_id` but **not** a thread id; the detail must resolve the
message's thread + real `thread_type`, then reuse the existing thread-level pattern:
- **Client viewer:** `/messages` (their single shared thread; client sources are ALWAYS
  `client_shared`).
- **Staff viewer:** `/clients/{clientId}/messages` for a **shared** source, or
  `/clients/{clientId}/messages?tab=internal` for an **internal** source. **This link MUST
  branch on the message's real `thread_type`** — the current staff board link
  (`staff-tasks-manager.tsx` line 130) hardcodes the shared tab and is a latent bug the detail
  must fix.

### (c) Task-created system message's "link to the task" → detail (NET-NEW)
This is link (b) of §2's reasoning — a relative `?task={id}` so the SAME shared-thread message
resolves for both audiences:
- **Client surface:** `/tasks?task={id}`.
- **Staff surface:** `/clients/{clientId}/tasks?task={id}`.
Because a system message lives in a thread shown to a fixed audience, and both list pages exist
and are RLS-scoped, the modal pattern lets each side reuse its own page. The render of the
system message can produce the audience-correct href client-side from the viewer's namespace
(or store per-recipient if it ever becomes a notification).

---

## 4. `update_task` RPC design (client title/description edit)

A NEW client-only RPC to let a client edit **title + description only** of an own-client,
visible task. It must **NOT** touch `status` (staff-locked), `assignee_id`, `due_date`,
`visible_to_client`, `source_message_id`, or `created_by`. Template = the now-dropped
`update_task_status` own-client+visible block + the `update_project` btrim/nullif set-list.

```sql
-- New: client title/description-only edit. STATUS stays staff-only (update_task_status
-- was dropped by 20260617233418). Mirrors update_task_status' own-client + visible gate
-- and update_project's title/description set-list.
create or replace function public.update_task(
  p_task_id uuid,
  p_title text,
  p_description text
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_row    public.tasks;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if v_client is null then
    raise exception 'Only clients can update tasks here';
  end if;

  select * into v_row from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  -- own-client AND visible gate: internal/staff-only tasks (visible_to_client=false)
  -- and cross-client tasks are untouchable. (Identical to update_task_status.)
  if v_row.client_id is distinct from v_client or not v_row.visible_to_client then
    raise exception 'Not authorized for this task';
  end if;

  if coalesce(btrim(p_title), '') = '' then
    raise exception 'Title is required';
  end if;

  update public.tasks
     set title = btrim(p_title),
         description = nullif(btrim(p_description), '')
   where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_task(uuid, text, text) from public, anon;
grant execute on function public.update_task(uuid, text, text) to authenticated;
```

Why this exact shape:
- `security definer set search_path = ''` + fully-qualified names — the standing RPC header.
- The own-client+visible gate is the **verbatim** `update_task_status` line — internal tasks
  (`visible_to_client=false`) and cross-client tasks RAISE.
- `revoke … from public, anon` then `grant execute … to authenticated` — mirrors
  `create_project`/`update_project`, adapted to the 3-arg signature.
- Status is **structurally** un-settable: it is not in the param list nor the `set` clause, and
  there is no client UPDATE policy, so the only client write path leaves status staff-owned.

**Client action wrapper** (`lib/actions/tasks-client.ts`, NET-NEW `updateTaskAction`):
`requireProfile` → `role === "client"` guard → Zod (a title-required + optional-description
schema) → `supabase.rpc("update_task", { p_task_id, p_title, p_description })` → `logAudit`
(`task.updated`, `by:"client"`) → `revalidatePath("/tasks")`. No status/assignee/visibility
fields are accepted by the action.

**Tests** (`scripts/test-rls.ts` tasks group; fixtures already present):
- happy path: client edits `visTaskId` ("RLSTASK-visible", premier, visible) title/desc → succeeds;
- read-back asserts `status` UNCHANGED (status untouched);
- empty title → RAISES "Title is required";
- "RLSTASK-hidden" (premier, `visible_to_client=false`) → RAISES "Not authorized for this task";
- "RLSTASK-cross" (pulse) → RAISES (cross-client);
- direct `client.from("tasks").update({ title })` → 42501 (no client UPDATE policy).

---

## 5. Client vs Staff field/control matrix (detail view)

| Field | Client detail | Staff detail | Backing |
| --- | --- | --- | --- |
| **title** | shown; **editable** | shown; editable | client: NEW `update_task` RPC. staff: `TaskFormDialog` → `staffUpdateTaskAction`. |
| **description** | shown; **editable** | shown; editable | same as title. |
| **status** | shown **read-only** (`StatusChip kind="task"`) — **NO control** | **editable** (inline `<Select>` over `TASK_STATUSES` → `staffSetTaskStatusAction`, optimistic; also the dialog `Select`) | status is staff-only (RPC dropped). |
| **assignee** | shown read-only (`assigneeName ?? "Unassigned"`) | editable (dialog `Select`, NONE sentinel `__none__`; re-validated to the circle) | client cannot change assignee. |
| **due_date** | shown read-only (`Due {formatDate}`) | editable (dialog `DatePicker`) | staff-managed. |
| **visible_to_client** | **NOT shown** (absent from `ClientTaskRow`; RLS gate only) | editable `Switch` ("Visible to the client" / "Internal — staff-only") + amber `Lock` "Internal" badge | client never sees this column. |
| **source_message_id** | "Created from a message" → `/messages` (thread-level) | "Created from a message" → `/clients/{id}/messages[?tab=internal]` (branch on real `thread_type`) | back-reference only; not editable in update. |
| **created_by / created_at** | read-only (if surfaced) | read-only | never client-editable. |
| **delete** | none | `AlertDialog` → `staffDeleteTaskAction` | staff-only. |

Client read-only-status precedent is doubly confirmed: tasks (`client-task-board.tsx` lines
35-37 + `StatusChip` only) and the named "project-status-lock" (`projects-board.tsx` line 110,
read-only `StatusChip kind="project"`). All reusable with **zero new tokens/components**:
`StatusChip`, the `TASK_STATUSES` `Select`, `Dialog`, `Card`/`CardContent`,
`Label`/`Input`/`Textarea`/`DatePicker`/`Switch`.

---

## 6. Internal-thread boundary — task-created system message

**Premise correction (important):** `components/tasks/message-task-button.tsx` **does not
exist**, and the live composer task flow (`task-create-dialog.tsx`, opened from
`conversation.tsx`) is **SOURCE-LESS today** — it does NOT pass `source_message_id` (it only
seeds the draft text as the title). A true per-message "Create task" affordance with a real
`source_message_id`, and any "Task created" echo, are **NET-NEW** surfaces to be built.

### Is posting a "Task created: {title}" system message safe?

**Conditionally YES — only with a strict gate, and never cross-thread.**

**The exact safe gate:** post the system message **ONLY into the SAME thread the source
message lives in, with `thread_type` derived from the SOURCE MESSAGE's REAL `thread_type` read
server-side (never caller input / never the composer `audience` prop). Skip entirely for any
source-less task.** This is automatically boundary-safe because the echo inherits the source
message's exact audience — whoever could already read the source can read the echo, and no one
else.

Why this is correct (and why the naive version leaks):
- **Internal-sourced (staff-only) task → SHARED thread = LEAK.** Posting "Task created:
  {title}" to the shared thread would expose a staff-only task's existence + title to the
  client — the exact Phase 5c violation. **Never do this.**
- **Echo into the SAME thread as the source = safe.** Same-thread echo (internal→internal,
  shared→shared) has an audience identical to the source. Internal→internal does not leak
  (clients can't read internal); shared→shared is the only client-visible case and is always
  legitimate (client sources are always `client_shared`).
- The asymmetry is enforced by the write paths already: a CLIENT source is restricted by the
  `create_task` RPC to its OWN `client_shared` message (`m.thread_type = 'client_shared'`), and
  client tasks are hard-coded `visible_to_client=true` → a client echo has exactly one possible
  audience (shared) → intrinsically safe. STAFF `resolveSource` re-reads the real `thread_type`
  via the service role and forces `visible=false` for an internal source — so derive the echo's
  thread from that same `msg` row.

### How to insert the system message (schema constraints)

`messages` requires (`20260615224421_communication_4a.sql` + `_5d`):
- `body text NOT NULL` — must have non-empty body, e.g. `"Task created: {title}"`. No
  `is_system`/null-body path exists.
- `thread_type NOT NULL` and **denormalized** — must be stamped and MUST equal the parent
  thread's type (RLS `messages_client_select` keys off `thread_type = 'client_shared'`).
- `client_id NOT NULL` — must be stamped.
- `author_id` is **nullable** (`references profiles on delete set null`) → `author_id = null`
  is schema-legal for a system message, but **no system-message pattern exists** — every
  current insert (`post_message`) stamps `author_id = auth.uid()`, and the UI renders a null
  author as **"Removed user"** (`hydrateMessages`: `authorName: a?.name ?? "Removed user"`).
  Step-4 must add explicit system-message rendering for a distinct look.
- `deleted_at` must stay null for the row to be visible (SELECT policies narrowed with
  `and deleted_at is null`) — default null, so fine.

**Recommended mechanism — service-role insert in the SAME server action that created the
task**, reusing the already-fetched source message row:
```ts
// only when the source message is real AND from a thread the task's audience already shares
createAdminClient().from("messages").insert({
  thread_id:   msg.thread_id,      // from the SOURCE MESSAGE row
  client_id:   msg.client_id,      // from the SOURCE MESSAGE row
  thread_type: msg.thread_type,    // REAL type, server-read — NOT caller input / composer audience
  author_id:   null,               // system message
  body:        `Task created: ${title}`,
});
```
The service role bypasses RLS, so YOU own stamping `thread_type`/`client_id`/`thread_id`
correctly — take them from the same `msg` row whose `thread_type` decided the task's
visibility. (Alternative: a new `post_system_message(thread_id, body)` SECURITY DEFINER RPC
that re-reads the thread, stamps type/client_id, sets `author_id=null`, re-checks
`app.can_access_thread` — more in keeping with "writes via DEFINER RPC" but heavier.)

### Residual risks to flag

1. **Never** stamp `thread_type` from caller input or the composer `audience` prop — a staff
   member on the Internal tab could hold a shared-sourced task or vice-versa. Always derive
   from the SOURCE MESSAGE's real `thread_type` read server-side (the `resolveSource` pattern).
2. **Client path lacks a source-message read today.** `create_task` validates the source but
   `createTaskAction` doesn't return the thread id. To echo client-side you must obtain the
   (shared) thread id — but since client sources are ALWAYS `client_shared`/visible, a
   client-side echo is intrinsically single-audience-safe; you just need the thread id to
   target the insert.
3. **Realtime is inert to leaks for the echo.** A service-role INSERT broadcasts, but the
   realtime layer is RLS-enforced per subscriber AND `conversation.tsx` re-fetches via the
   RLS-scoped `getThreadMessagesAction` (never renders the raw payload) — triple protection.
4. **Source-less task → NO thread to echo into.** The current composer flow is source-less;
   skip the system message entirely (don't fabricate a thread). Only message-linked tasks echo.
5. **Echo to internal is allowed but is a separate decision.** Posting back into the INTERNAL
   thread does not leak (clients can't read internal), but gate it explicitly per-thread; do
   not conflate "safe to echo" with "shared only." The rule is: echo to the SAME thread the
   source lives in.

---

## 7. Reuse summary (zero new tokens/components)

- **Status:** client read-only `StatusChip kind="task"`; staff editable `TASK_STATUSES`
  `<Select>` (inline + dialog).
- **Dialog/motion:** `components/ui/dialog.tsx` (built-in `data-open:animate-in … zoom-in-95`
  CSS keyframes; `MotionProvider`'s `reducedMotion="user"` handles reduced motion — pass
  nothing). Spring tokens belong to `m.*` stagger wrappers, not the dialog.
- **Layout:** `Card`/`CardContent` (D2 `rounded-2xl border border-border … shadow-e2`) or the
  flat staff row style; `Label`/`Input`/`Textarea`/`Select`/`DatePicker`/`Switch` with the
  `space-y-2`/`space-y-4` rhythm + `text-sm text-destructive` errors; `User`/`MessageSquare`
  `text-xs text-ink-3` meta rows. `Stagger`/`StaggerItem` for any animated list.
- **Deep-link idiom:** `?task={id}` mirrors the existing `?tab=internal` `searchParams` pattern.

## 8. Test baseline

`scripts/test-rls.ts` prints a **dynamic** total (`${results.length - failed.length}/${results.length}`,
line 779). The last documented printed total is **214/214** at commit `107d114`
("Lock task status to staff"). The new `update_task` checks (happy edit, status-unchanged,
empty-title, invisible-denied, cross-client-denied, direct-UPDATE-denied) increase
`results.length` accordingly.

---

## 9. Built — Phase 2 task detail (2026-06-18, `ui-overhaul/task-detail`)

**Modal via `?task={id}`** (as recommended). `TaskDetailDialog` opens for a row already in
each surface's RLS-scoped list (client `/tasks`, staff `/clients/[id]/tasks`); a `?task` id
not in the list is a no-op — a client can never open an invisible/internal task.

- **`update_task(uuid,text,text)`** (migration `20260618001626`) — title + description ONLY,
  own-client + visible gate; `updateTaskAction` wraps it. **No escalation** (no param/column
  for status/assignee/due/visibility). **RLS suite 219/219.**
- **CLIENT detail** edits title + description; status is the read-only `StatusChip`, assignee
  + due read-only — **no status control** (Phase-1 lock preserved). **STAFF detail** has full
  control (status, assignee, due, visible, title/desc → `staffUpdateTaskAction`).
- Created-by / created-at shown; **"Created from a message"** resolves the source message's
  REAL `thread_type` (fixing the old hardcoded-shared staff link). Two commented host slots:
  `SUBTASKS (Phase 4)` + `TIME TRACKING (Phase 5, staff-only)`.
- Phase-3 hover-lift on client cards; Dialog spring; reduced-motion respected.

**Verified**: tsc + build green; live UI 14/14 (no client status control · a client can't open
an internal task · client edit saves without escalating status · staff full control · console
clean); a 6-skeptic adversarial workflow found **0 holes**.

### STEP 2.4 (task-created chat message) — FLAGGED, not built
The echo is **boundary-safe in principle** (post only into the source message's REAL thread
when `thread_type='client_shared'`; service-role insert stamped from the source row; skip
otherwise). But **every create path is source-less** (the composer `TaskCreateDialog` and the
staff form both omit `source_message_id`; the per-message "create task" button was deleted in
the chat polish), so the echo never fires. Making it fire needs source-linked creation —
**"changing task creation", which the invariant forbids**. So per "stop and flag rather than
guess", it is deferred with the verified-safe design above. The detail's read-only
source-link IS built (safe display).
