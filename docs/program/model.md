# P0 — Program Catalog: Data-Model Design (PROPOSAL, not applied)

Scope: **PROGRAM-type clients only.** This is a design + migration **proposal** for the owner's
review. It changes **no** app behavior, copy, RLS, or data. The proposed migration lives at
`docs/program/proposed-migration.sql` — deliberately **NOT** in `supabase/migrations/` so it can't
be auto-applied by `supabase db push`. Apply policy: **do not run against the shared DB without the
owner's explicit go** (or apply to a throwaway branch DB only).

---

## 1. What exists today (the starting point)

- `clients.program` — `program_tier` enum (`foundation | pipeline | operating_system | pulse`),
  **NOT NULL**, a **single** value. Read by the Program tab, the dashboard label, `client_clients`
  view, and `labelOf(PROGRAMS, …)`.
- `clients.whats_included` / `whats_not_included` — **free text per client** (manually typed by
  staff). The "What's included" card renders these strings; nothing is catalog-driven.
- `metric_definitions` — **per-client rows** (`client_id, key, label, unit, sort_order, is_active`,
  `unique(client_id,key)`), seeded on client insert by `seed_new_client()`:
  - `program='pulse'` → social set; **all three core tiers → the SAME SEO set** (incl. `ad_spend`,
    `ad_conversions`, `cost_per_lead` even for **Foundation**, which sells no ads — a real defect).
- `metric_entries` — `definition_id, period, value_numeric|value_text`, `unique(definition_id,period)`.
  Team enters monthly via the metrics grid. **No `source` field anywhere** → not integration-ready.

**Two gaps this phase designs away:** (a) a client can't hold a **core tier + Pulse** (single enum
field); (b) "what's included" + the KPI set are **not** program-driven (free text + a flat per-tier seed).

---

## 2. Proposed catalog (4 new tables — full DDL in proposed-migration.sql)

### `programs` — the four programs
| col | type | note |
|---|---|---|
| id | uuid pk | |
| key | text unique | `foundation`/`pipeline`/`operating_system`/`pulse` — **matches the existing `program_tier` enum values** (clean reconciliation) |
| name | text | "Foundation" / "Pipeline" / "Operating System" / "Pulse" |
| tagline | text | short positioning line (owner-approved copy) |
| tier_order | int null | core stack rank: foundation=1, pipeline=2, operating_system=3; **null** for Pulse |
| is_parallel | boolean | **true for Pulse** (runs standalone or alongside any tier), false for the core tiers |
| is_active | boolean | |

### `program_services` — what each program ADDS (stack resolves at read time)
Stores each program's **own** additions only (NOT the cumulative set) — so editing one program never
duplicates copy. The cumulative "included" set is resolved by the rule in §3.

| col | type | note |
|---|---|---|
| id | uuid pk | |
| program_id | uuid → programs | |
| label | text | e.g. "Google Ads (Search + Maps)" |
| description | text null | one-line detail for the card |
| category | text | `seo`/`gbp`/`content`/`aeo`/`ads`/`ai`/`crm`/`social`/`strategy`/`exclusivity` (for grouping + deliverable-expectation mapping) |
| sort_order | int | |
| is_active | boolean | |

### `program_kpis` — the KPI DEFINITIONS per program (integration-ready)
The catalog of which numbers each program reports. **The manual-entry metric grid is generated from
the resolved set of these** (see §6); a future Google Ads / Meta / GA4 / Search Console sync writes
the same KPI by `key` + `source` — no re-architecture.

| col | type | note |
|---|---|---|
| id | uuid pk | |
| program_id | uuid → programs | |
| key | text | **stable** metric key, reused as `metric_definitions.key` (e.g. `leads`, `ad_spend`, `reach`) |
| label | text | display label |
| unit | `metric_unit` | reuse the existing enum (`number`/`currency`/`percent`/`text`) |
| source | text | **integration key** — `manual` now; later `gsc`/`gbp`/`google_ads`/`meta_ads`/`ga4` |
| sort_order | int | |
| is_active | boolean | |
| unique (program_id, key) | | |

### `client_programs` — the client → program assignment (staff-only)
The link that lets a client hold **one core tier AND (optionally) Pulse**. Replaces the single
`clients.program` field as the *source of truth for assignment* (see §4 for the reconciliation).

| col | type | note |
|---|---|---|
| client_id | uuid → clients (cascade) | |
| program_id | uuid → programs | |
| assigned_by | uuid → profiles null | audit trail |
| created_at | timestamptz | |
| **pk (client_id, program_id)** | | a client can't be assigned the same program twice |
| **partial unique:** `(client_id) where program.is_parallel = false` | | **at most ONE core tier per client** (enforced via a trigger/constraint — see migration; the core tiers are mutually exclusive, Pulse is additive) |

A client is therefore: **0–1 core tier + optional Pulse**, with ≥1 program assigned. (A Pulse-only
client = the Pulse row, no core tier — the owner's "Pulse standalone".)

---

## 3. Stacking + Pulse-parallel resolution

The three core tiers **stack** (each includes the previous); Pulse is **parallel** (additive). The
resolved sets are computed at read time, not stored, so the catalog stays DRY.

**Resolved included services for a client** = union of `program_services` where:
- the program is a **core tier** with `tier_order <= (the client's assigned core tier's tier_order)`, **OR**
- the program is **Pulse** and the client is assigned Pulse.

**Resolved KPI set** = the same union over `program_kpis`.

Proposed read helpers (SECURITY DEFINER or plain views; details in the migration):
- `app.client_core_tier_order(client_id)` → the assigned core tier's `tier_order` (or null).
- view `client_included_services` / `client_program_kpis` — resolve the above per the caller's own
  client for the client UI; staff read any via the same logic scoped by assignment.

Example — a **Pipeline + Pulse** client resolves to: Foundation services + Pipeline services + Pulse
services; KPIs likewise. A **Foundation-only** client: Foundation only (no ad KPIs — fixes the defect).

---

## 4. Reconciliation with the existing `clients.program` (EXTEND, don't replace — preserve data)

**Decision: extend.** Keep `clients.program` exactly as-is (NOT NULL, single value) so **every
existing surface keeps working unchanged in P0**; introduce `client_programs` as the new assignment
source of truth, populated by a **non-destructive backfill**.

- **Backfill (in the proposal):** for every existing program-type client, insert a `client_programs`
  row matching its current `clients.program`. So a `program='pipeline'` client → one `client_programs`
  row (pipeline). Existing `program='pulse'` clients → a Pulse row (no core tier) — exactly today's
  meaning. **No existing column changed, no data lost.**
- **`clients.program` stays** as the legacy "primary program" (still drives today's UI). A **later
  phase** flips the reads (Program tab / KPI seed / what's-included) to resolve from `client_programs`
  + the catalog; until then both coexist and agree (the backfill keeps them in sync).
- **Why not replace `clients.program` now:** it's NOT NULL and read in ~6 places + the `client_clients`
  view; replacing it is behavior change (out of scope for P0). Extending is reversible and safe.
- **`whats_included` / `whats_not_included` stay** as a **per-client override/fallback**: when present
  they win; otherwise the resolved catalog set renders. (Migration keeps them; no rewrite in P0.)
- **`metric_definitions.source`** — propose **adding** the column (`text not null default 'manual'`).
  Backfill existing rows to `'manual'`. This makes the *current* per-client manual grid
  integration-ready without touching entry behavior.

---

## 5. RLS plan (no-direct-client-write held; staff-only assignment)

- **Catalog tables (`programs`, `program_services`, `program_kpis`)** — reference data:
  - `admin` / `team`: full read (and admin write to curate the catalog).
  - `client`: **SELECT only** (they need labels/descriptions to render their resolved sets). Read is
    safe — it's the public service catalog, no client data.
- **`client_programs`** — the assignment, **staff-only write** (the project/task-status lock pattern):
  - `admin`: all. `team`: all where `is_assigned(client_id)`. `client`: **SELECT own only**
    (`client_id = app.my_client_id()`), **NO INSERT/UPDATE/DELETE policy**.
  - The **only** mutation path is staff (admin/team direct writes under their policies) — exactly like
    `deliverables`/`projects` staff writes; **clients have no write path** → the **no-direct-client-write
    invariant holds**, and program assignment is **staff-only** (mirrors project-status / task-status locks).
- The four invariants are untouched: this adds reference tables + a staff-writable link + a client
  SELECT — no client write surface, no change to existing RLS.

---

## 6. How the program drives each surface (the dot-connecting map)

| Surface | Today | Program-driven (target; P0 designs, later phase wires) |
|---|---|---|
| **Program tab — "What's included" card** | free-text `whats_included` | resolved `client_included_services` (stacked + Pulse), grouped by `category`; `whats_included` as optional override |
| **Program tab — "What's not included"** | free-text | derive from catalog gaps (services on higher tiers the client doesn't have) + keep free-text override |
| **Performance — KPI set** | flat per-tier seed (same SEO set for all core tiers) | resolved `client_program_kpis` (per §3) → ensure matching `metric_definitions` rows → team enters monthly; Foundation loses ad KPIs, Pipeline gains them, OS gains multi-channel |
| **Deliverable expectations** | none (free) | catalog `category` → expected deliverable types (e.g. `ads`→`landing_page`/`ad_creative`; `content`→`blog_post`/`content_calendar`) — a guidance layer, not a lock |
| **Dashboard / Program copy** | generic strings | program `name` + `tagline` + resolved set (see content-audit.md) |
| **Staff assignment UI** | the single program dropdown on create/settings | core-tier select + a **Pulse toggle** writing `client_programs` (staff-only) |

---

## 7. Migration + apply policy

- Full DDL + seed + backfill: **`docs/program/proposed-migration.sql`** (a proposal artifact, NOT in
  `supabase/migrations/`).
- It is **additive + non-destructive**: new tables, a new nullable-defaulted column
  (`metric_definitions.source`), catalog seed, and an idempotent backfill of `client_programs` from
  `clients.program`. No drops, no column type changes, no behavior change.
- **Not applied** to the shared/linked DB. On approval, it becomes a real timestamped migration in
  `supabase/migrations/` and is pushed (or trialed on a branch DB) — that's P1, not P0.

---

## 8. Open questions for the owner (decide before P1)

1. **Foundation display name** — pricing sheet says "Core (Foundation)". Show as "Foundation",
   "Core", or "Core — Foundation"? (catalog `name`/`tagline`).
2. **What's-not-included** — derive from the catalog (higher-tier services) automatically, or keep it
   purely manual?
3. **Pulse standalone** — confirm a Pulse-only client should see **no** core-tier program tab content
   (only social services + KPIs). The model supports it; confirm the UX.
4. **Cutover timing** — when to flip reads from `clients.program` → `client_programs`+catalog (P1?),
   and whether to eventually drop `clients.program` (a later, separate, destructive migration).
