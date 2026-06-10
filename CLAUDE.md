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
> **Next up: P6 (Hardening & launch).**
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
