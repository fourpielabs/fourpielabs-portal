# CLAUDE.md — 4Pie Labs Client Portal

Guidance for Claude Code working in this repo. **`PORTAL_SPEC.md` is the source
of truth** — read it fully before writing code. This file is the quick-reference
summary; if the two ever disagree, the spec wins, and update this file to match.

## What this is

A private, invite-only client portal for **4Pie Labs** (an AI-first marketing
agency for local service businesses). Replaces a Notion client-portal template
and covers the full lifecycle: onboarding → delivery → reporting → off-boarding.
Four programs: Foundation, Pipeline, Operating System, Pulse.

- **Completely separate** from the marketing site: own repo, own Vercel project,
  own Supabase project.
- **Production domain:** `portal.fourpielabs.com`.

## Tech stack (fixed — do not substitute)

- Next.js 15+, App Router, TypeScript, **Server Components by default**
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth, Storage, **Row Level Security**
- `@supabase/ssr` for server + browser clients; session refresh in `middleware.ts`
- Recharts (charts); React Hook Form + Zod (forms)
- Vercel hosting (auto-deploy on push to `main`); Supabase CLI for all migrations
- Brand: match fourpielabs.com — clean, modern, **amber/orange accent (~`#d97706`)**.
  The client-facing side must feel like a product, not an admin panel.

## Roles & access control (3 roles, RLS-enforced)

`profiles.role` enum = `admin | team | client`. **ALL enforcement is via Postgres
RLS**; UI role checks are convenience only and server actions re-check too.

- **admin** — full CRUD on everything; manages users/clients/assignments; reads audit log.
- **team** — full CRUD only for clients assigned via `client_assignments`. No unassigned
  clients, no user management.
- **client** — read-only on their own client's data where `visible_to_client = true`
  (reports also require `published = true`). **Exactly one write path:** toggling
  onboarding checklist items where `assignee = 'client'`, only via the
  `toggle_checklist_item(item_id)` SECURITY DEFINER function. No direct client UPDATE
  policy exists on any table.

**Signup policy:** no public signup; Supabase email signups disabled. Accounts exist
only via admin invitations (`inviteUserByEmail` from a server route; role + client_id
in invite metadata; a trigger on `auth.users` creates the `profiles` row).

## Database & migrations

- All tables in `public`, **RLS enabled on every table**.
- **Supabase migrations only** (`supabase/migrations/*.sql`) — never ad-hoc schema changes.
- **⛔ DESTRUCTIVE-REMOTE RULE (standing, all sessions):** plain `supabase db reset`
  (LOCAL) is always fine. **NEVER** run `supabase db reset --linked` — or any other
  destructive command against the REMOTE database — without the user's explicit,
  per-instance approval. This holds even when the remote looks empty.
- RLS helpers (SECURITY DEFINER): `is_admin()`, `is_team()`, `my_client_id()`,
  `is_assigned(cid)`, `toggle_checklist_item(item_id)`.
- `clients.internal_notes` is **never** readable by clients — expose client-safe columns
  via a view / column grants.
- Triggers seed on client insert: onboarding + off-boarding checklists, the 90-day
  milestone roadmap, and program-specific metric definitions.
- Storage: private bucket `client-files`, path `{client_id}/{uuid}-{filename}`, policies
  mirror table rules; downloads via short-lived signed URLs from server actions.

Tables (see spec §4 for columns): `clients`, `profiles`, `client_assignments`,
`checklist_items`, `milestones`, `deliverables`, `content_items`,
`metric_definitions`, `metric_entries`, `competitors`, `call_types`,
`call_recordings`, `meeting_notes`, `reports`, `updates`, `files`, `invitations`,
`audit_log`.

## App structure

App Router under `app/`: `(auth)/` (login, accept-invite, forgot-password) and
`(portal)/` (dashboard, clients/[clientId]/{checklist,program,content,metrics,
competitors,deliverables,calls,notes,reports,updates,files,settings},
admin/{users,audit}, settings). `middleware.ts` handles session refresh + auth
redirects. Supabase clients in `lib/supabase/{server,client,admin}.ts`; auth guards
in `lib/auth/guards.ts`.

**Client-facing nav:** Dashboard · Program · Content · Performance · Deliverables ·
Calls & Notes · Documents. Zero edit affordances beyond the onboarding checklist toggle.

## Conventions

- Mutations via **server actions only**; Zod validation; re-check role server-side
  even though RLS protects; **write `audit_log` on every mutation**.
- Service-role key is **server-only — never `NEXT_PUBLIC`**.
- Loading / empty / error states everywhere; fully mobile-responsive (clients use phones).
  Friendly empty states.
- **Design-vs-RLS precedent (standing, from the UI phase):** when an approved mockup
  implies access a role's RLS doesn't grant, **RLS wins** and the UI adapts — never
  widen RLS to match a mockup. Example: the staff client-overview "activity feed" is a
  derived read of deliverables/updates/reports (works for team), **not** a raw
  `audit_log` read (admin-only).
- **UI Excellence Pass — DONE (closes the UI phase):** the seven per-client staff
  editor tabs (Program/milestones, Competitors, Notes, Reports, Updates, Files,
  client Settings) were **lifted from accepted-B `rounded-lg` list rows to D2 Card
  rows** (`rounded-2xl border border-border bg-surface shadow-e1 hover:shadow-e2`).
  Also resolved from the old backlog: Button **`loading`** is now a first-class
  variant (spinner + `aria-busy`, two render paths so `asChild`/Slot stays
  single-child) adopted at all submit sites; **Skeleton** broadened to list/table/
  chart route loaders (admin/users, clients, performance, metrics); the metrics
  **month-picker pill** (humanized label + chevron over the native input) and
  **definitions grip handle** (keyboard ↑/↓ kept) shipped; the K3 performance chart
  got its **D4 §05 amber area-fill gradient**. Avatar adoption DONE (UI-6) —
  `PersonAvatar` (image→initials) is live at every person/client tile.
- **UI backlog still deferred (no current call site):** Checkbox / Radio /
  Pagination components (the app uses the custom checklist toggle + Switch, and
  nothing paginates); styled **date / file-dropzone** pickers (native
  `<input type=date|file>` remain — functional); Button **`active`** first-class
  state. Add only when a surface needs them.
- **Design system reference:** `design/` now holds **only the three permanent system
  docs** — `D1 Style Tile`, `D2 Component Sheet`, `D4 Handoff Sheet` (in
  `design/project/`). The K1–K6 keystone mockups and the byte-identical `design/v2`
  bundle served their purpose and were removed (recoverable from git history). D1/D2/D4
  + `SITE_STRUCTURE.md` remain the design source of truth.

## Build phases (complete + verify each before the next)

- **P1 Foundation** — scaffold; all migrations (enums, tables, helpers, RLS, storage,
  seeding triggers); auth (login, accept-invite, middleware, role redirects); seed
  script (1 admin, 1 team, 2 demo clients [pipeline + pulse], 1 client user). Verify
  `supabase db reset` runs clean.
- **P2 Admin** — clients CRUD (triggers seeding), invite flow, users list/deactivate,
  team↔client assignments, audit viewer.
- **P3 Team core** — client overview; checklist editor; program page + milestones;
  deliverables; files/documents; updates.
- **P4 Team trackers** — content calendar; metrics (definitions, monthly grid, CSV
  import, charts); competitors; call types + recordings; meeting notes; reports + publish.
- **P5 Client experience** — full client UI; `toggle_checklist_item` flow; branded
  polish; signed-URL downloads; report viewer.
- **P6 Hardening & launch** — RLS verification tests (cross-client reads/writes must
  fail; unassigned-team access must fail); audit coverage; mobile/Lighthouse; deploy +
  custom domain.

> **Onboarding + Projects sub-phase COMPLETE (2026-06-15).** Migration
> `20260615181456_onboarding_projects.sql` (pushed): `clients.client_type`
> enum `program|project` (default `program` — existing clients untouched); new
> `projects` table (RLS: admin all / team `is_assigned` / client SELECT own;
> NO client INSERT/UPDATE policy); `deliverables.project_id` (nullable FK);
> client write path via SECURITY DEFINER RPCs `create_project` /
> `update_project` (type-gated to `project` clients, own-client only, status
> settable by the owning client); `client_clients` view gains `client_type`
> (explicit column list, still no `internal_notes`); `seed_new_client()` GATED
> so project clients seed NO checklist/roadmap/metrics (program path byte-for-
> byte unchanged). Provisioning: admin "create client account" — the
> **conditional** create-client form (`components/clients/client-create-form.tsx`)
> puts `client_type` FIRST and reacts to it: program shows the Program tier;
> **project hides it** (general fields + account section only). It also takes an
> optional client-user email/name and provisions the client login via the
> existing prefetch-safe welcome/invite email (`createClientAction`); client
> **invites are now staff-only** (admin/team) in `sendInviteAction` +
> `invite-form.tsx`. **Project clients store `program='foundation'` as a neutral
> baseline** — the `clients.program` column is NOT NULL but is never read for
> project clients (set in `createClientAction`). Client experience: project
> clients get the **projects board** (`components/client/projects-board.tsx` +
> `project-dialog.tsx`) instead of the program dashboard (`client-dashboard.tsx`
> branches on `client_type`); the **Program, Performance + Content** tabs are
> hidden (presentation-only, `client-shell.tsx` — project clients see only
> Dashboard · Deliverables · Calls & Notes · Documents) and those routes
> (`/program`, `/performance`, `/content`) **redirect** project clients to
> `/dashboard` (guards intact, no error). `test:rls` **123/123** (project
> write-path, SELECT scoping, type-gate, team assigned/unassigned, anon,
> seed-gating both directions); E2E (`scripts/verify-projects.mjs`) **16/16**.
> **v1 follow-ups (NOT built):** (1) an "invite client user" action on the
> client **settings** page, to provision a login for a client created without an
> email (today the only provisioning point is the create-client form); (2) make
> `clients.program` **nullable** so project clients carry no dummy program tier
> (current baseline is the `'foundation'` placeholder above).
>
> **Project-completion sub-phase COMPLETE (2026-06-16).** Wires the project↔client
> relationship end-to-end — **NO migration** (staff ride the existing `projects` +
> `deliverables` for-all policies; clients stay RPC-only, no new client write policy).
> Staff project management: `staffCreate/Update/SetStatus/DeleteProjectAction`
> (`lib/actions/projects.ts`; `requireClientAccess`; direct writes scoped
> `.eq("client_id", clientId)`; `projectStaffSchema` adds start/due dates — the client
> RPC has none, so dates are staff-managed); a project-client-only **Projects tab**
> (`app/(portal)/clients/[clientId]/projects/page.tsx` +
> `components/projects/{staff-projects-manager,project-form-dialog}.tsx`). Per-client
> staff tabs branch on `client_type` (`client-tabs.tsx` — project clients get Overview ·
> Projects · Deliverables · Calls; program-only tabs hidden). **Deliverable→project
> link** (`deliverables.project_id` now has UI): `deliverableSchema.project_id` threaded
> through create/update with a **same-client guard** (`resolveProjectId` rejects a
> foreign project_id — RLS checks the deliverable's client_id but not the linked
> project's), a Project picker in the deliverable dialog (project clients only), and a
> project badge per linked deliverable; project cards (staff manager + client board) list
> their deliverables (bidirectional). **Staff visibility:** clients grid + dashboard cards
> show a Project badge + project count/active (not the empty checklist, under a "Progress"
> column); the staff client **overview** branches to a projects summary (count by status +
> recent projects) for project clients; `StatusChip` gains a `project` kind. Audit:
> `project.status_changed` / `project.deleted` added. `test:rls` **125/125** (+2: staff can
> set `deliverables.project_id`; a client cannot). E2E (`scripts/verify-projects.mjs`)
> **25/25** (staff create/edit/status, link a deliverable, bidirectional display,
> cross-client rejection). **Out of scope (future ideas, NOT built):** project files /
> notes / time tracking / budgets / invoicing; project-change notifications (Phase 4).
>
> **Phase 4a (Communication data layer) COMPLETE (2026-06-16).** Migrations
> `20260615224421_communication_4a.sql` + `20260615225734_communication_4a_fix_can_access.sql`
> (both pushed). `threads` (`client_shared` | `internal`, unique `(client_id,type)`),
> `messages` (`client_id` + `thread_type` denormalized for RLS), `thread_reads`
> (PK `(thread_id,user_id)`, unread mechanism) — all RLS-enabled. RLS shape =
> admin all · team `is_assigned(client_id)` for BOTH types · client SELECT-only its
> OWN `client_shared` thread + messages (internal invisible at the DB layer). Client
> writes via SECURITY DEFINER RPCs ONLY: `post_message(thread_id, body)` and
> `mark_thread_read(thread_id)` (scope via `app.can_access_thread`); **no direct
> client INSERT/UPDATE policy** on threads/messages/thread_reads. Seeding:
> `seed_client_threads()` AFTER INSERT trigger seeds 1 shared + 1 internal per client
> for BOTH program AND project clients (NOT gated, unlike the program-only roadmap
> seed); existing clients backfilled. **Security fix mid-phase:** `app.can_access_thread`
> leaked for unassigned team (`x = my_client_id()` → NULL → past `if not NULL`) — fixed
> with `coalesce(..., false)`; a same-pattern audit of all live policies/RPCs found NO
> other holes (see the `language sql` coalesce note in Schema notes). `test:rls`
> **152/152** (new `messaging` + `seeding` groups). NO UI/bell/email yet — those are
> 4b–4d (PHASE4_COMMUNICATION_BLUEPRINT.md to be re-shared; it fell out of the repo
> during compaction).
>
> **Phase 4b (Notifications + bell) COMPLETE (2026-06-16).** Migration
> `20260615232217_notifications_4b.sql` (pushed): `notifications` table — per-USER
> rows (each recipient gets their own row + `read_at`), RLS read/update-OWN only
> (`user_id = auth.uid()`), NO insert/delete policy (service-role inserts on events,
> the audit_log precedent). Event generation in `lib/notifications.ts` (`notify`
> de-dupes + excludes the author; `clientUserIds`/`staffUserIds`) wired into the
> existing actions: deliverable delivered→client (on the visible transition),
> approved→staff, report published→client, project status→the other side; plus
> `postMessageAction` (new — wraps the 4a `post_message` RPC). The
> **internal-thread-never-notifies-client** rule + author-exclusion live in the pure
> `lib/notification-recipients.ts#messageRecipientIds()` (single source of truth),
> derived from the RPC-stamped `msg.thread_type` (the real thread, not caller input).
> Bell: `components/shell/notification-bell.tsx` on all three shells (unread badge,
> dropdown, mark-read single/all, deep-link), fetch-on-load + on-navigation (NO
> realtime — that's 4c). Tests: `test:rls` **159/159** (new `notifications` group);
> `scripts/test-notify.ts` **10/10** (recipient logic); `scripts/verify-messages-notify.ts`
> **9/9** (internal boundary: ZERO for ALL client users + staff notified + author
> excluded; shared both ways); `scripts/verify-notifications.mjs` **4/4** (approve→
> staff-notified/client-not + bell). Blueprint restored at the repo root. Remaining:
> **4c** (messaging UI + Supabase Realtime) · **4d** (Resend email w/ throttle).
>
> **Phase 4c (Messaging UI + Realtime) COMPLETE (2026-06-16).** Migration
> `20260616002055_messaging_realtime_4c.sql` (pushed) — **publication membership
> only**: `alter publication supabase_realtime add table messages, notifications`
> (no RLS/table change; `test:rls` stays 159). Client surface: `/messages` route +
> nav (program AND project) — the client sees ONLY their own `client_shared` thread
> (RLS; no internal surface anywhere). Staff surface: a **Messages** tab on the
> per-client workspace (both client types) with **Client** (shared) + **Internal**
> (`?tab=internal`) sub-threads; the Internal tab/composer/button are amber-warning-
> toned and BOTH composers carry an unmissable who-can-see indicator —
> **"Visible to the client"** (emerald) vs **"Internal — the client cannot see this"**
> (amber lock) — the human-error guardrail (wrong-thread posting cuts both ways).
> Shared `<Conversation>` (`components/messaging/conversation.tsx`): markdown bodies
> (reuses `components/markdown.tsx`), own-vs-other bubbles, composer →
> `postMessageAction`, **optimistic own-message append**. Server actions (extend
> `lib/actions/messages.ts`): `getThreadMessagesAction` (RLS-scoped; author names via
> service role) + `markThreadViewedAction` (mark_thread_read RPC + clears the bell's
> `message` notifications for THAT thread via the `link`). **Realtime** = Supabase
> `postgres_changes` (RLS-enforced per subscriber) — **triple boundary**: (1) RLS at
> the realtime layer, (2) subscription filtered to the open `thread_id`, (3) events
> only TRIGGER a refetch via the RLS-scoped action (never render the raw payload), so
> a stray payload is inert. Bell subscribes to `notifications` changes → live updates.
> **Channel names are unique per subscription** (the bell renders twice — sidebar +
> mobile — and StrictMode double-mounts; a shared name collides). Tests:
> `verify-realtime.ts` **2/2** (BLOCKER — a client subscription gets ZERO internal
> messages, DOES get shared); `verify-messaging.mjs` **9/9** (client shared-only +
> posts; staff dual-thread with the distinct Internal treatment; internal never
> reaches the client) + screenshots @1440/390; `test:rls` **159**. The 4b message
> deep-links (`/messages`, `/clients/{id}/messages?tab=internal`) now resolve.
> Remaining: **4d** (Resend email notifications with throttle/batch).
>
> **Phase 4d (Email notifications via Resend) COMPLETE (2026-06-16) — Phase 4 DONE.**
> NO migration (throttle reuses `notifications` timestamps; `test:rls` stays 159). The
> app sends notification emails itself via the **Resend HTTP API (`fetch`, `lib/email.ts`)**
> — not SMTP, no new package (SMTP stays Supabase's auth-mail path). `notify()`
> (`lib/notifications.ts`) now, after inserting the in-app rows, **emails the SAME recipient
> list** — so the internal-thread boundary holds in email too (a client is never in the
> internal recipient set → never emailed; the FOURTH channel). **Content-leakage rule:**
> `buildNotificationEmail()` has **NO `body` param** — emails carry only the safe title
> (sender/event) + client + a portal link; message text never leaves the portal.
> **Throttle:** leading-edge, 1 message-email per recipient/thread per 5 min (derived from
> notification timestamps, no table) + skip if the recipient viewed the thread <2 min ago
> (`thread_reads`). Emails set **`reply_to: team@fourpielabs.com`** (from
> `noreply@mail.fourpielabs.com`); brand via `emailBrand()` (text wordmark mirroring
> `BrandLogo` — logo swap is one change, the logged blocker). Missing `RESEND_API_KEY` → a
> **logged no-op** (app never breaks). Tests: `test-email.ts` **7/7** (no-body/content
> rules); `scripts/verify-email.mjs` **7/7** (EMAIL_CAPTURE sink: internal→staff/NEVER
> client, no body, throttle cap 3→1, deliverable approved→staff). **Launch items
> (LAUNCH.md §3b):** add `RESEND_API_KEY` to Vercel; auth-email reply-to needs a Supabase
> "Send Email" hook (flagged, not blocking); email logo swap. **Next:** 4e (per-user
> notification email preferences — has a migration).
>
> **Phase 4e (Per-user email preferences) COMPLETE (2026-06-16) — PHASE 4 FULLY DONE.**
> Migration `20260616022443_notification_preferences_4e.sql` (pushed): one row per user,
> a boolean column per notification type, **every column `default true`** (opt-out baked
> in). RLS = self-manage **own** (select/insert/update `user_id = auth.uid()`, no delete) —
> per-user personal state, the notifications/profiles precedent; rows are seeded **lazily on
> first Save** (no `handle_new_user` change). **Absence-of-row = all-on** lives in both the
> send logic and the settings UI, so a user who never opens Settings stays fully notified.
> `notify()`'s EMAIL step gains an **email-only** gate: it fetches the candidates' pref rows
> and drops only those whose type column is explicitly `false` (`sendIds = emailIds.filter(id
> => !optedOut.has(id))` — **no row stays in → SEND**); the in-app bell row always inserts.
> Type↔column map + per-role receivability in `lib/notification-prefs.ts` (client sees 4
> toggles, staff 3). Settings UI: `components/settings/email-preferences.tsx` (role-filtered
> `Switch`es) on `/settings` for all three roles; `updateEmailPreferencesAction` upserts own.
> Tests: `test:rls` **166/166** (new `notif_prefs` group: read-own / cross-user 0 / upsert-own
> / cross-user update+insert denied / anon denied); `scripts/verify-prefs.mjs` **6/6** —
> **DEFAULT (no row) → client EMAILED** (the absence-of-row=send guard, so new users aren't
> silently muted), OFF → suppressed but bell still inserts, ON → resumes, + settings-save smoke.
>
> **✅ PHASE 4 (Communication + Notifications) COMPLETE — 4a · 4b · 4c · 4d · 4e all shipped.**
>
> **Current status:** P1 + P2 + P3 COMPLETE. Migrations on the linked Tokyo
> project (`frmukrgjkhlpxplhzeqj`); auth + demo seed (P1); admin workspace (P2);
> team workspace core (P3): per-client layout with assignment-scoped guard
> (`requireClientAccess`) + tabs, client overview, checklist editor (both kinds,
> CRUD/reorder/toggle/visibility), program page + milestones editor, deliverables
> (CRUD, status workflow, file upload, delivered_at), files/documents
> (upload/category/visibility/signed-URL download/delete), updates (composer,
> pin, visibility, edit/delete own). Actions in `lib/actions/*`, Zod in
> `lib/schemas.ts`, audit via service-role `lib/audit.ts`. Storage helpers in
> `lib/actions/storage.ts` (upload + short-lived signed URLs; clients never get
> a storage policy — signed-URL only, per review R1).
> **P4 COMPLETE (Team workspace, trackers):** content calendar (table + month
> view, status workflow, filters), metrics (definitions manager, monthly entry
> grid with upsert on `(definition_id, period)`, CSV import with template +
> preview + per-row errors, Recharts numeric charts + text monthly table),
> competitor tracker, calls (call_types + call_recordings), meeting notes,
> reports (CRUD + optional PDF + publish/unpublish setting `published_at`;
> unpublished never visible to clients via RLS). Actions: `lib/actions/{content,
> metrics,competitors,calls,notes,reports}.ts`. **All per-client tabs now live.**
>
> **P5 COMPLETE (Client experience):** client-only top-level routes
> `/{dashboard,program,content,performance,deliverables,calls-notes,documents}`
> with client nav (no team chrome; clients redirected off `/clients` + `/admin`).
> Read-only throughout except the onboarding checklist toggle via the
> `toggle_checklist_item` RPC (`components/client/client-checklist.tsx`). Client
> reads the safe `client_clients` + `client_partner` views; all lists are
> RLS-scoped to visible/published. Markdown via `react-markdown`
> (`components/markdown.tsx`); enum labels humanized everywhere. Verified at the
> data layer: hidden/unpublished items absent, base `clients` unreadable, RPC
> denies team/off-boarding toggles, no cross-client leakage.
>
> **P6 (Hardening) DONE in code:** `npm run test:rls` (`scripts/test-rls.ts`) —
> 97/97 pass (client cross-client reads 0, every write 42501-denied, RPC gating,
> team-unassigned + anon fully denied, storage signing denied). Audit coverage
> verified across all mutation actions (fixed the metrics-reorder gap). Client
> polish applied (charts window to data; humanized dates; collapsible completed
> checklist; friendly empty states; bigger mobile tap target). Lighthouse mobile
> on `/login`: a11y 96 / BP 100 / SEO 91 / perf ~28 (client-JS bound; see LAUNCH.md).
>
> **`LAUNCH.md`** is the go-live runbook (human dashboard tasks, in order):
> Vercel Pro, Supabase Pro (no auto-pause), Resend SMTP, Auth URL + email
> templates → `/auth/confirm`, custom domain + DNS, `NEXT_PUBLIC_SITE_URL`
> switch, DB-password rotation + User-scope cleanup, and LAST: deactivate the
> 3 demo accounts via the UI. **Remaining before live = those LAUNCH.md steps.**
>
> **Auth pipeline (config now managed via the Management API, not the dashboard):**
> Supabase auth config PATCHed to `site_url=https://fourpielabs-portal.vercel.app`
> (no trailing slash), `uri_allow_list` = that `/**` + `http://localhost:3000/**`,
> `disable_signup=true`, branded subjects, and the **token_hash templates pointing
> at `/auth/confirm`** (replacing the stock `{{ .ConfirmationURL }}` that caused
> "expired link"). `/auth/confirm` is now a **click-through interstitial**
> (`app/auth/confirm/page.tsx` → POST `verifyEmailOtpAction`) so email-scanner
> prefetch can't burn the one-time token. Users list detects **Pending invite**
> (auth `email_confirmed_at` null) with **Resend/Revoke** actions
> (`lib/actions/users.ts`). Invite/reset failures map to specific errors + audit
> (`user.invite_failed/_resent/_revoked`, `password_reset.failed`).
>
> Scaffold facts: Next.js 16 (App Router) + React 19 + Tailwind v4 +
> shadcn/ui (radix). Brand amber accent in `app/globals.css`. Supabase clients
> in `lib/supabase/{server,client,admin,middleware}.ts`. Session refresh + auth
> gating in `proxy.ts` (Next 16's rename of `middleware.ts`) via
> `lib/supabase/middleware.ts`; server-side guards in `lib/auth/guards.ts`
> (`requireProfile`, `requireRole`). Migrations: `supabase/migrations/2026061001000{1..8}_*.sql`.
> Signups disabled in `supabase/config.toml`.
>
> **Auth flow:** `app/(auth)/{login,forgot-password,accept-invite}` (client forms,
> RHF + Zod, browser Supabase client); `app/auth/confirm/route.ts` (token_hash
> verify for invite/recovery — needs Supabase email templates pointed at it,
> a launch task) and `app/auth/signout/route.ts`. Portal layout enforces
> `requireProfile()`.
>
> **Seed:** `scripts/seed.ts` (`npm run seed`, service-role, idempotent). Creates
> 2 clients (Premier Painting Co. = pipeline/SEO; Coastal Tours Co. = pulse/social)
> + 3 users. Demo logins (password `FourPie!Demo2026`):
> `demo-admin@example.com`, `demo-team@example.com` (assigned to both),
> `demo-client@example.com` (Premier Painting). Re-running is safe.
>
> **Local env:** `.env.local` is populated (gitignored) with URL + anon +
> service-role key (retrieved via the authenticated CLI) so `npm run dev`/`seed`
> work locally.

### Schema notes

- **⚠️ `language sql` boolean security helpers MUST `coalesce(..., false)`** their
  result — they lack the explicit null-guards the `plpgsql` RPCs have (which start
  with `if app.my_client_id() is null then raise` or use `is distinct from`). A bare
  `x = app.my_client_id()` is **NULL** for staff (my_client_id is null), and a SQL
  function returns that NULL up to `if not <fn>` in the caller, where `if not NULL`
  silently doesn't raise → access leaks. This was the `app.can_access_thread` (4a)
  root cause; fixed by wrapping the `select` in `coalesce(..., false)`.
- **Enums: exactly the 14 from spec §4** — `user_role`, `client_status`,
  `client_industry`, `program_tier`, `checklist_kind`, `checklist_assignee`,
  `milestone_status`, `deliverable_status`, `deliverable_type`, `content_status`,
  `content_platform`, `metric_unit`, `file_category`, `competitor_priority`.
  No extras. (A step-3 report said "16 enums" — that was a miscount; the
  migration always defined 14.)
- **Review changes applied pre-push (R1–R3):**
  - R1 — no client policy on `storage.objects`; clients get files ONLY via
    server-minted signed URLs after a `files.visible_to_client` check.
  - R2 — `enforce_profile_self_update()` allows the `service_role` context
    (`auth.role() = 'service_role'`) so admin/seed server actions aren't blocked.
  - R3 — `client_clients` and the new `client_partner` definer view both use
    explicit column lists (never `select *`); `client_partner` exposes only
    `id, full_name, avatar_url, email`; the old full-row `client_select_partner`
    profiles policy was removed.

### Setup status (as of 2026-06-10)

Done:
- Repo initialized; remote `origin` = `github.com/fourpielabs/fourpielabs-portal`
  (private). `main` pushed.
- `PORTAL_SPEC.md`, this `CLAUDE.md`, `.gitignore`, `.env.local.example`, and
  `supabase/` scaffold committed. `.env.local` present locally and gitignored.
- `.mcp.json` at project scope: read-only hosted Supabase MCP
  (`mcp.supabase.com`, `project_ref=frmukrgjkhlpxplhzeqj`, `read_only=true`) +
  Vercel MCP (`mcp.vercel.com`). Secrets via `${SUPABASE_ACCESS_TOKEN}` /
  `${SUPABASE_PROJECT_REF}` expansion — no literals committed.
- Vercel project connected to the repo: the push **triggered a production
  deployment**, which **failed as expected** (no Next.js app/`package.json`
  yet). Deploys will go green once P1 scaffolds the app.

Done:
- **`supabase link` complete and verified on the fourpielabs project.** The
  fourpielabs `SUPABASE_ACCESS_TOKEN` (persisted at Windows User scope)
  overrode the CLI's stored personal login; `supabase projects list` shows the
  `●` LINKED marker on `frmukrgjkhlpxplhzeqj` = `fourpielabs-portal`
  (org `sokuiylewhqvrpfsafxv`), and `supabase/.temp/project-ref` matches. The
  DB password was skipped at link time — supply it (prompt or
  `SUPABASE_DB_PASSWORD`) before the first `supabase db push`.
- `.mcp.json` now hardcodes the (public, non-secret) `project_ref`; only the
  token comes from `${SUPABASE_ACCESS_TOKEN}` env expansion.

Pending — in-IDE Supabase MCP connection:
- The hosted MCP server reads `${SUPABASE_ACCESS_TOKEN}` from **Claude Code's
  own process env**, which is still stale: env vars are captured when the VS
  Code app launches, and a new Claude *session* inside an already-running VS
  Code does **not** re-read them. The token IS persisted at User scope (so a
  fresh VS Code launch will inherit it) — the running process just predates it.
- **To finish:** fully **quit and reopen VS Code** (the whole app, not just a
  new Claude chat), approve the project-scope `supabase` MCP server when
  prompted, then run `/mcp` to confirm `supabase` shows **connected
  (read-only)**. Credential validity is already proven (link + projects list
  succeeded with this token), so this is the last mechanical step.
- After that, the environment-setup phase is fully signed off — only then start P1.

## Environment & tooling

`.env.local` (never commit) holds the four spec §7 vars:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
NEXT_PUBLIC_SITE_URL=               # localhost:3000 locally; prod URL on Vercel
```

- Supabase CLI linked to the 4Pie Labs project; migrate with `supabase db push` /
  `supabase db reset`. `supabase link` reads `SUPABASE_ACCESS_TOKEN` from the
  environment — never hardcode or echo it.
- Push to `main` → Vercel auto-deploys.
- **MCP servers are configured at PROJECT scope only** (`.mcp.json` in this repo),
  authenticated against 4Pie Labs accounts. **Never** touch the developer's
  global/user-scope MCP config (personal accounts). Secrets in `.mcp.json` use
  `${VAR}` expansion, not literals.

## Non-goals for v1 (do not build)

Live API integrations (GSC/GA4/Google Ads/Meta/Ahrefs — `metric_entries` is the future
integration point); client comments/approvals beyond the checklist toggle; billing
engine (invoices are just files); real-time notifications; white-labeling; multi-language.
