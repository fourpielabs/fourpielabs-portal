# 4Pie Labs Client Portal — Build Specification (v2)

> Source of truth for the 4Pie Labs client portal. Lives in the repo root.
> Claude Code: read this fully before writing any code. Keep CLAUDE.md in sync.
> v2 incorporates the full feature set of the agency's Notion client-portal
> template (onboarding checklist, program overview, content calendar, growth
> tracker, competitor tracker, calls & recordings, meeting notes, documents,
> off-boarding) on top of the v1 dashboard/RLS architecture.

---

## 1. What we're building

A private, invite-only client portal for 4Pie Labs (fourpielabs.com), an
AI-first marketing agency serving local service businesses (painting
contractors, tour operators, other local services) across four programs:
Foundation, Pipeline, Operating System, Pulse. The portal replaces a Notion
template and covers the full client lifecycle: onboarding → delivery →
reporting → off-boarding.

Completely separate from the marketing site: own repo, own Vercel project,
own Supabase project. **Production domain:** `portal.fourpielabs.com`.

---

## 2. Tech stack (fixed — do not substitute)

- Next.js 15+, App Router, TypeScript, Server Components by default
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth, Storage, Row Level Security
- `@supabase/ssr` (server + browser clients), session refresh in `middleware.ts`
- Recharts for charts; React Hook Form + Zod for forms
- Vercel hosting (deploys on push to `main`); Supabase CLI for all migrations
- Brand: match fourpielabs.com — clean, modern, amber/orange accent
  (~`#d97706`), professional. The client-facing side must feel like a product,
  not an admin panel.

---

## 3. Roles & access control

Three roles in `profiles.role` (enum `admin | team | client`). ALL enforcement
via Postgres RLS; UI checks are convenience only.

- **admin** — full CRUD on everything; manages users, clients, assignments;
  sees audit log.
- **team** — full CRUD on every entity of clients they're assigned to via
  `client_assignments`. Cannot see unassigned clients or manage users.
- **client** — read-only on their own client's data where
  `visible_to_client = true` (reports also require `published = true`),
  **with exactly one write exception:** toggling the done-state of onboarding
  checklist items where `assignee = 'client'`, performed only through the
  `toggle_checklist_item(item_id)` SECURITY DEFINER function (validates
  ownership, kind = 'onboarding', assignee = 'client'; updates only
  `is_done/done_by/done_at`). No direct UPDATE policy for clients on any table.

**Signup policy:** no public signup. Supabase email signups disabled. Accounts
exist only via admin invitations (`inviteUserByEmail` from a server route;
role + client_id carried in invite metadata; trigger on `auth.users` creates
the `profiles` row).

---

## 4. Database schema

All tables in `public`, RLS enabled on every table. Supabase migrations only
(`supabase/migrations/*.sql`) — never ad-hoc schema changes.

### Enums
```
user_role:          admin | team | client
client_status:      onboarding | active | paused | churned
client_industry:    painting_contractor | tour_operator | other_local_service
program_tier:       foundation | pipeline | operating_system | pulse
checklist_kind:     onboarding | offboarding
checklist_assignee: client | team
milestone_status:   upcoming | in_progress | done
deliverable_status: pending | in_progress | needs_review | delivered
deliverable_type:   blog_post | landing_page | ad_creative | design | video
                    | gbp_update | content_calendar | report | strategy_doc | other
content_status:     idea | drafting | in_review | approved | scheduled | published
content_platform:   blog | gbp | instagram | tiktok | youtube | facebook
                    | linkedin | google_ads | meta_ads | email | other
metric_unit:        number | currency | percent | text
file_category:      agreement | onboarding_form | welcome_doc | invoice
                    | brand_asset | template | strategy_doc | report | other
competitor_priority: low | medium | high
```

### Tables

**clients** — one row per client business.
- Identity: `id`, `name`, `slug unique`, `industry`, `program program_tier`,
  `status`, `website_url`, `logo_url`.
- Engagement: `start_date`, `end_date date null`, `service_type text null`
  (e.g. "Done For You"), `investment text null` (amount + payment structure;
  shown on the client's Program page), `onboarding_form_url text null`,
  `welcome_doc_url text null`, `comms_channel text null`
  (e.g. "WhatsApp group"), `primary_contact_user_id uuid null` (the team
  member shown as "Your Partner" on the client side).
- Program overview content: `whats_included text` (markdown list),
  `whats_not_included text` (markdown list), `best_way_to_reach text`,
  `response_time text` (e.g. "Within 24 hours, weekdays"),
  `call_scheduling_note text`, `revision_policy text`
  (e.g. "2 rounds per deliverable").
- `internal_notes text` (NEVER readable by client role — expose client-safe
  columns through a view or column grants), timestamps.

**profiles** — `id uuid pk references auth.users`, `role user_role`,
`full_name`, `email`, `avatar_url`, `client_id uuid null` (set when role =
client), `is_active bool default true`, timestamps.

**client_assignments** — `client_id`, `user_id`, `assigned_by`, `created_at`.
PK `(client_id, user_id)`.

**checklist_items** — onboarding + off-boarding checklists.
- `id`, `client_id`, `kind checklist_kind`, `phase_label text`
  (e.g. "Phase 1 — Before We Start"), `title`, `link_url text null`,
  `assignee checklist_assignee default 'client'`, `sort_order int`,
  `is_done bool default false`, `done_by uuid null`, `done_at timestamptz null`,
  `visible_to_client bool` (default true for onboarding, false for offboarding),
  timestamps.
- Seed on client creation: the standard 4Pie Labs onboarding checklist
  (3 phases: Before We Start / Getting Set Up / First Call Done — sign
  agreement, first payment, onboarding form, welcome doc, bookmark portal,
  book strategy call, join comms channel, send brand assets, ICP & offer
  clarity, share analytics access, attend call, approve strategy doc, approve
  first content calendar, automation setup, first content live) and the
  off-boarding checklist (final deliverables sent, final report delivered,
  assets shared, final call done, recording shared, testimonial requested,
  referral conversation, renewal decision recorded, final message sent,
  portal access updated).

**milestones** — the program journey/roadmap shown to the client.
- `id`, `client_id`, `title`, `description text`, `phase_label`
  (e.g. "Weeks 1–2"), `status milestone_status`, `due_date null`,
  `sort_order`, `visible_to_client default true`, timestamps.
- Seed the default 4Pie Labs 90-day roadmap on client creation:
  Discovery & Audit (Wk 1) → Foundation Build (Wk 2) → AEO + Content Engine
  (Wk 3–4) → Ads Launch + Optimization (Wk 5–8) → Scale & Compound (Wk 9–12).
  Team can rename/replace per client (e.g. 3-phase journeys for Pulse).

**deliverables** — everything promised, with status + link (the
"Deliverables Hub").
- `id`, `client_id`, `title`, `description`, `type deliverable_type`,
  `status deliverable_status default 'pending'`, `due_date date null`,
  `preview_url text null` (live link), `file_path text null` (Storage),
  `visible_to_client default false`, `delivered_at null`, `created_by`,
  timestamps.

**content_items** — the Content Calendar (works for blog/SEO content AND
social content).
- `id`, `client_id`, `title` (post title / hook), `platform content_platform`,
  `content_type text null` (e.g. Reel, Carousel, Blog post),
  `status content_status default 'idea'`, `publish_date date null`,
  `cta text null`, `core_message text null`, `notes text null`,
  `asset_url text null`, `views_after_posting numeric null`,
  `visible_to_client default true`, `created_by`, timestamps.

**metric_definitions** — configurable KPI set per client (replaces v1's fixed
metric enum; this is what lets SEO clients and social clients track different
things, including text metrics like "Hook that worked best").
- `id`, `client_id`, `key slug`, `label`, `unit metric_unit`, `sort_order`,
  `is_active bool default true`. Unique `(client_id, key)`.
- Seed by program on client creation:
  - foundation / pipeline / operating_system: Leads, GBP Calls, Top-3
    Keywords, Map-Pack Keywords, AEO Citations, Organic Traffic, Ad Spend
    (currency), Ad Conversions, Cost per Lead (currency), Key Learning (text).
  - pulse: Total Views, Follower Count, Follower Growth, Profile Visits,
    Inbound DMs, Sales Calls Booked, New Clients Closed, Revenue This Month
    (currency), Best Performing Post (text), Hook That Worked Best (text),
    Key Learning (text).

**metric_entries** — monthly values.
- `id`, `client_id`, `definition_id`, `period date` (first of month),
  `value_numeric numeric null`, `value_text text null`, `created_by`,
  timestamps. Unique `(definition_id, period)`, upsert on conflict.

**competitors** — the Competitor Tracker.
- `id`, `client_id`, `name_or_handle`, `niche text`, `follower_count int null`,
  `avg_views int null`, `top_content_format text`, `hook_style text`,
  `whats_working text`, `gap_notes text` ("what they are NOT doing"),
  `adapted_idea text`, `priority competitor_priority default 'medium'`,
  `visible_to_client default true`, timestamps.

**call_types** — bookable call definitions per client ("Book a Call").
- `id`, `client_id`, `name` (e.g. Monthly Review Call), `duration_label`,
  `frequency_label`, `booking_url` (Calendly etc.), `sort_order`, timestamps.

**call_recordings** — log of past sessions.
- `id`, `client_id`, `call_date date`, `call_type text`, `recording_url`,
  `key_topic text`, `visible_to_client default true`, `created_by`, timestamps.

**meeting_notes** — one entry per session.
- `id`, `client_id`, `meeting_date date`, `title` (e.g. "Strategy Call"),
  `body text` (markdown — decisions, actions, next steps),
  `visible_to_client default true`, `author_id`, timestamps.

**reports** — monthly performance reports.
- `id`, `client_id`, `title`, `period_start`, `period_end`, `summary text`
  (markdown), `pdf_path null`, `published bool default false`, `published_at`,
  `created_by`, timestamps.

**updates** — activity-feed posts from team to client.
- `id`, `client_id`, `author_id`, `title`, `body` (markdown), `pinned bool`,
  `visible_to_client default true`, timestamps.

**files** — Documents & Agreements + general shared files.
- `id`, `client_id`, `name`, `category file_category default 'other'`,
  `storage_path`, `mime_type`, `size_bytes`, `visible_to_client default false`,
  `uploaded_by`, `created_at`.

**invitations** — `id`, `email`, `role`, `client_id null` (required when role
= client), `invited_by`, `accepted_at null`, `created_at`. (Token/expiry
handled by Supabase invite flow.)

**audit_log** — `id`, `actor_id`, `action` (e.g. `deliverable.created`),
`entity`, `entity_id`, `client_id null`, `metadata jsonb`, `created_at`.
Insert-only from server actions on every mutation. Admin-readable only.

### RLS helpers (SECURITY DEFINER)
```
is_admin() · is_team() · my_client_id() · is_assigned(cid uuid)
toggle_checklist_item(item_id uuid)   -- the single client write path
```

### RLS pattern (every client-scoped table)
- admin: all ops. team: all ops where `is_assigned(client_id)`.
- client: SELECT where `client_id = my_client_id() AND visible_to_client`
  (reports: `published = true`; metric_definitions/metric_entries/milestones/
  call_types: visible by default, no flag needed except where defined).
- `clients`: client role reads own row through a client-safe view that
  excludes `internal_notes`.
- profiles: own row read/update (never `role`/`client_id`); admin all; team
  reads profiles connected to assigned clients; client reads own +
  the `primary_contact_user_id` profile's name/avatar (their "partner").
- invitations, audit_log: admin only. client_assignments: admin all, team
  reads own rows.

### Storage
Private bucket `client-files`. Path `{client_id}/{uuid}-{filename}`. Policies
mirror table rules (admin all; team within assigned clients; client read own
folder). Downloads via short-lived signed URLs from server actions.

---

## 5. App structure & routes

```
app/
  (auth)/login · accept-invite · forgot-password
  (portal)/
    dashboard/                       # role-aware home
    clients/                         # team/admin: assigned-client grid
      [clientId]/
        page.tsx                     # overview: status, checklist progress,
                                     # latest metrics, recent activity
        checklist/                   # onboarding + off-boarding editor
        program/                     # program overview + milestones editor
        content/                     # content calendar CRUD (table + month view)
        metrics/                     # definitions manager + monthly entry grid
                                     # + CSV import + charts
        competitors/                 # competitor tracker CRUD
        deliverables/                # CRUD + visibility toggle
        calls/                       # call types (booking links) + recordings
        notes/                       # meeting notes CRUD
        reports/                     # CRUD + publish toggle
        updates/                     # feed composer
        files/                       # upload/manage, categories, visibility
        settings/                    # client details, program overview fields
    admin/users · admin/audit        # invites, roles, assignments; audit log
    settings/                        # own profile
middleware.ts                        # session refresh + auth redirects
lib/supabase/{server,client,admin}.ts · lib/auth/guards.ts
```

### Client experience (role = client)
Navigation: **Dashboard · Program · Content · Performance · Deliverables ·
Calls & Notes · Documents**.
- **Dashboard:** welcome card (program, start/end dates, "Your Partner" with
  avatar + contact channel), "Start Here" onboarding checklist with progress
  bar (items tickable by the client when assignee = client; links render as
  buttons), KPI cards from latest month vs previous, roadmap progress, latest
  deliverables, latest published report, pinned + recent updates.
- **Program:** program details table (name, service type, duration,
  investment, dates), journey phases (milestones), what's included / not
  included, communication guidelines (reach, response time, scheduling,
  revision policy).
- **Content:** read-only content calendar — list + month view, status chips,
  links to published pieces.
- **Performance:** charts for numeric metrics (last 6–12 months), monthly
  table including text metrics, competitor tracker (read-only), published
  reports list + viewer.
- **Deliverables:** the hub — status key (Delivered / In Progress / Needs
  Review / Pending), dates, preview links, file downloads.
- **Calls & Notes:** booking links (call_types as cards with "Book" buttons),
  past recordings list, meeting notes (read).
- **Documents:** files grouped by category (Agreement, Onboarding Form,
  Welcome Doc, Invoices & Payments, Other).

### Conventions
- Mutations via server actions only; Zod validation; role re-checked
  server-side even though RLS protects; write `audit_log` on every mutation.
- Service-role key server-only, never `NEXT_PUBLIC`.
- Loading/empty/error states everywhere; fully mobile-responsive (clients
  will use phones). Friendly empty states ("Your first report lands after
  month 1").

---

## 6. Build phases (complete + verify each before the next)

**P1 — Foundation.** Scaffold; all migrations (enums, tables, helpers, RLS,
storage, triggers: profile creation, checklist + milestone + metric-definition
seeding on client insert); auth (login, accept-invite, middleware, role
redirects); seed script (1 admin, 1 team, 2 demo clients — one pipeline, one
pulse — with realistic data across every table, 1 client user). Verify
`supabase db reset` runs clean.

**P2 — Admin.** Clients CRUD (creation triggers seeding). Invite flow (server
route, admin API). Users list/deactivate. Team↔client assignments. Audit
viewer.

**P3 — Team workspace, core.** Client overview tab; checklist editor (both
kinds, reorder, links, assignee); program page (overview fields + milestones);
deliverables; files/documents with categories; updates.

**P4 — Team workspace, trackers.** Content calendar (table + month view,
status workflow); metrics (definitions manager, monthly grid entry, CSV
import, charts); competitors; call types + recordings; meeting notes; reports
with publish.

**P5 — Client experience.** Everything in "Client experience" above; the
`toggle_checklist_item` flow; branded polish; signed-URL downloads; report
viewer.

**P6 — Hardening & launch.** RLS tests: as client, attempt cross-client reads,
writes to every table, toggling team-assigned or offboarding checklist items —
all must fail; as team, attempt unassigned-client access — must fail. Audit
coverage. Mobile/Lighthouse pass. Deploy checklist + custom domain.

---

## 7. Environment & tooling

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
NEXT_PUBLIC_SITE_URL=               # localhost:3000 locally; prod URL on Vercel
```

Workflow: Supabase CLI linked to the 4Pie Labs project for migrations
(`supabase db push` / `db reset`); git push to `main` → Vercel auto-deploy.
Any MCP servers (Vercel/Supabase/GitHub) must be configured at **project
scope** (`.mcp.json` in this repo) authenticated against the 4Pie Labs
accounts — never modify the developer's global/user-scope MCP config, which
points at personal accounts.

---

## 8. Non-goals for v1 (do not build)

Live API integrations (GSC, GA4, Google Ads, Meta, Ahrefs — `metric_entries`
is the future integration point); client comments/approvals beyond the
checklist toggle; billing engine (invoices are just files); real-time
notifications; white-labeling; multi-language.

---

## 9. Definition of done

- All RLS verification tests pass (P6).
- Admin can, from the UI alone: create a client (auto-seeded checklist,
  roadmap, metric definitions) → invite a team user → assign → invite a
  client user.
- Team can run the full lifecycle: tick onboarding items, manage content
  calendar, enter monthly metrics, track competitors, log a call recording,
  write meeting notes, deliver a deliverable, publish a report, post an
  update, complete off-boarding.
- Client logs in, ticks their onboarding steps, and sees a branded,
  mobile-friendly portal covering every section of the original Notion
  template — with zero edit affordances beyond their checklist.
- Live at portal.fourpielabs.com with env vars + Supabase auth URLs configured.
