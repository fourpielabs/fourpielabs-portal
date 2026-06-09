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

> **Current status:** environment setup only. No app code yet. Do not start P1 until
> the environment session is signed off.

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
