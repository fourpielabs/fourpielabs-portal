# Account Inventory — test-account cleanup (DRY RUN · NOTHING DELETED)

Generated read-only via `scripts/account-inventory.ts` against the linked production DB.
**No deletions performed. Awaiting explicit human confirmation of the KEEP/DELETE lists below.**

Heuristic for the flag: `TEST` = `@example.com`, `demo-`/`audit-`/`test-` prefix, or a known
seed/demo client name (Premier Painting / Coastal Tours / Demo Project / Sunrise Plumbing /
Harbor Lab). `real?` = doesn't match any test heuristic → a candidate real account for you to confirm.

## All users (7 auth users = 7 profiles; no orphans)

| flag | role | email | name | client | created | last login |
|---|---|---|---|---|---|---|
| **TEST** | admin | demo-admin@example.com | Avery Admin | — | 2026-06-17 | 2026-06-19 |
| real? | admin | **syedsuqlain36@gmail.com** | kashi | — | 2026-06-16 | 2026-06-18 |
| real? | admin | **shahmir687@gmail.com** | Shahmir | — | 2026-06-16 | 2026-06-16 |
| real? | client | **fourpielabs@gmail.com** | Fourpie Labs | FourPie Labs | 2026-06-15 | 2026-06-17 |
| **TEST** | team | demo-team@example.com | Riley Partner | — | 2026-06-17 | 2026-06-19 |
| **TEST** | client | demo-client@example.com | Pat Premier | Premier Painting Co. | 2026-06-10 | 2026-06-19 |
| **TEST** | client | demo-project@example.com | Jordan Project | Demo Project Co. | 2026-06-19 | 2026-06-19 |

## All clients (6)

| flag | name | slug | type | status | created | users |
|---|---|---|---|---|---|---|
| **TEST** | Premier Painting Co. | premier-painting | program/pipeline | active | 2026-06-10 | demo-client@example.com |
| **TEST** | Coastal Tours Co. | coastal-tours | program/pulse | active | 2026-06-10 | (none) |
| real? | **FourPie Labs** | fourpie-labs | project | onboarding | 2026-06-15 | fourpielabs@gmail.com |
| **TEST** | Demo Project Co. | demo-project | project | active | 2026-06-17 | demo-project@example.com |
| **TEST** | Sunrise Plumbing Co. | audit-empty-program | program | onboarding | 2026-06-17 | (none) |
| **TEST** | Harbor Lab Studio | audit-empty-project | project | active | 2026-06-17 | (none) |

---

## ✅ Proposed KEEP (real — confirm names/emails)

**Real humans (staff):**
- `syedsuqlain36@gmail.com` — display name **"kashi"**, role **admin**. Appears to be the owner
  (Syed). **Confirm this is you + the name is intended ("kashi" vs your real name).**
- `shahmir687@gmail.com` — **"Shahmir"**, role **admin**. (Shahmeer.) **Confirm.**

> Note: these are the ONLY two non-test humans in the DB. You mentioned "and others" — there are
> **no other real human staff accounts** present (the only `team` user is the demo one). If other
> people should exist, they were never created (or only as demo logins).

**Real client (+ its login) — the candidate you should pick:**
- Client **"FourPie Labs"** (`fourpie-labs`, project type, onboarding, created 2026-06-15) +
  its login `fourpielabs@gmail.com` ("Fourpie Labs", role client). This is the **only** client
  that isn't an obvious seed/demo and the one that matches "the real client the owner created for
  his labs." **Confirm KEEP — and confirm whether the `fourpielabs@gmail.com` client login should
  stay** (vs. you accessing it as admin).

## 🗑️ Proposed DELETE (test/dev/demo/seed)

**Users (4):**
1. `demo-team@example.com` — "Riley Partner", team. (Redesign-review demo login.)
2. `demo-client@example.com` — "Pat Premier", client of Premier Painting Co.
3. `demo-project@example.com` — "Jordan Project", client of Demo Project Co.
4. `demo-admin@example.com` — "Avery Admin", admin. **(Delete LAST — see guard below.)**

**Clients (5):**
1. `Premier Painting Co.` (premier-painting) — P1 seed demo.
2. `Coastal Tours Co.` (coastal-tours) — P1 seed demo (no login).
3. `Demo Project Co.` (demo-project) — project demo.
4. `Sunrise Plumbing Co.` (audit-empty-program) — audit/empty test client (no login).
5. `Harbor Lab Studio` (audit-empty-project) — audit/empty test client (no login).

### Cascade impact (per the schema's FK `ON DELETE CASCADE` to `client_id`)
- **Deleting a CLIENT** cascades its ENTIRE workspace: checklist_items, milestones, deliverables,
  content_items, metric_definitions + metric_entries, competitors, call_types + call_recordings,
  meeting_notes, reports, updates, files (+ Storage objects under `{client_id}/`), projects, tasks
  (+ task_checklist_items, time_entries), threads + messages + thread_reads, client_assignments,
  and any audit_log/notifications scoped to it. (Premier Painting + Demo Project carry real demo
  workspaces; Coastal/Sunrise/Harbor are near-empty.)
- **Deleting a USER** removes the `auth.users` row and cascades its `profiles` row (+ its
  notifications, notification_preferences, and client_assignments). It does NOT delete content the
  user authored — that's retained and shown as "Removed user" (per the app's delete semantics).

### Safe deletion ORDER (preserve ≥1 real active admin at all times)
- **Current active admins: 3** — `syedsuqlain36`, `shahmir687`, `demo-admin`. **Real active admins
  remaining after cleanup: 2** (`syedsuqlain36`, `shahmir687`) → deleting `demo-admin` never trips
  the last-active-admin guard.
1. Delete the test **client users** first: `demo-client`, `demo-project`, then the test **team
   user** `demo-team` (no admin-guard risk).
2. Delete the test **clients** (cascades their workspaces): Premier Painting, Demo Project, Coastal
   Tours, Sunrise Plumbing, Harbor Lab Studio. (Order among clients doesn't matter; each cascade is
   self-contained. Deleting the client user in step 1 first avoids a dangling client-scoped profile.)
3. **LAST:** delete `demo-admin@example.com` — only after confirming the 2 real admins are active.
   Never delete `syedsuqlain36`/`shahmir687`; never self-delete the account performing the deletion.

### Execution note (when authorized)
- Via the **app UI** (`deleteUserAction` / client delete): respects the last-admin + self-delete
  guards automatically, one at a time.
- Via a **service-role script**: bypasses RLS + the app guards, so the order above must be enforced
  by hand (and the two real admins explicitly excluded). I'll mirror the app's semantics
  (`auth.admin.deleteUser` for users; `delete from clients where id=…` for the cascade).

---

**STATUS: dry run complete. No users or clients were modified. Awaiting your confirmation of the
exact KEEP/DELETE list before any deletion.**
