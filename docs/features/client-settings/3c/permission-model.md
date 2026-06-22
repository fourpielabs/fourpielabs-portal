# 3c — client edit-permission allowlist (model)

## Principle (non-negotiable)
A **deny-by-default ALLOWLIST** that an admin uses to **widen** a client's ability to edit a
**short, curated set of SAFE fields on their own client record**. It is **not** a matrix, **not**
an override. The invariant-carrying fields are **not expressible** — they are neither columns in
the permission table nor settable by the enforcement RPC. The floor (RLS + the RPC's hardcoded
settable set) holds **regardless of any permission value**.

## The curated SAFE allowlist (what an admin MAY grant)
Fields currently **denied** to clients (no client write path to the `clients` table today), safe to
delegate to a client editing their own business info:

| Permission column | Field on `clients` | Why safe |
|---|---|---|
| `can_edit_website_url`   | `website_url`   | The client's own business website. Cosmetic; no access/billing/scope impact. |
| `can_edit_comms_channel` | `comms_channel` | The client's preferred contact channel (free text). |

> Note on the brief's example ("project brief/title/target_date"): for **project clients those are
> already baseline-editable** via the `update_project` RPC. Gating them would **narrow** today's
> baseline, which the floor forbids ("can only WIDEN from deny-by-default"). So the allowlist instead
> covers **currently-denied** safe fields (the client's business-profile contact fields above). The
> baseline (project title/description/priority/target_date, task title/description, checklist toggle,
> deliverable approval, milestone sign-off, messages) is **unchanged**.

## EXPLICITLY EXCLUDED — can NEVER be a permission option (the floor)
Not columns in `client_field_permissions`, not in any RPC's settable set:
- **Task / project STATUS** (the status lock) — `update_task`/`update_project` have no status param.
- **Deliverable / milestone APPROVAL** — only `set_deliverable_approval` / `sign_off_milestone`,
  which set only the approval/sign-off timestamp, never status; not grantable, not widenable.
- **Visibility flags** (`visible_to_client`) — staff-only.
- **Assignee**, **staff `due_date`**, **start_date** — staff-only.
- **Client record control fields**: `status`, `program`, `client_type`, `name`, `slug`, `industry`,
  `service_type`, `investment`, `start_date`, and **`internal_notes`** (never client-readable).
- **No-direct-client-write** — clients still have no INSERT/UPDATE policy on any table; the only new
  path is the SECURITY DEFINER RPC below.
- **Internal-thread access** and the **staff-only timer** — untouched; not grantable.

## Storage
`client_field_permissions` (one row per client; PK `client_id`): a boolean per curated field,
**default false** (deny). RLS: **admin all**; team + client may **SELECT** (own / assigned) to render
the right controls; **no client/team write**. Absence of a row = all-denied.

## Enforcement (server-side, one place)
RPC `client_update_profile_field(p_field text, p_value text)` (SECURITY DEFINER):
1. resolves the caller's own `client_id` (raises if not a client);
2. **validates `p_field` against the hardcoded safe set** `{website_url, comms_channel}` — anything
   else **raises** (a locked field name can't even be addressed);
3. **checks the per-client grant** for that field — missing/false → **raises** (deny-by-default);
4. updates **exactly that one safe column** on the caller's own client (a hardcoded per-field
   `UPDATE` — no dynamic SQL, locked columns unreachable by construction).

A permission only flips a boolean for a safe field; it can **never** escalate to a locked field
because no locked field is in the table or the RPC. **Granting every permission cannot cross the
floor** (proven in `scripts/test-rls.ts` under max-permission).

## Admin set / client edit
- Admin grants via `setClientFieldPermissionsAction` (admin-only, audited `client_permissions.updated`).
- Client edits a granted field via `clientUpdateProfileFieldAction` → the RPC. Non-granted fields
  render read-only; locked fields (status, etc.) are read-only **always**, independent of permission.
