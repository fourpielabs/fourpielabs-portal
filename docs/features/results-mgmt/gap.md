# /results management — gap map (STEP 1)

Branch `feat/results-management` from `b7d415c`. **Read the code before building — and the
premise needs correcting.**

## How `/results` reads (client side)
`app/(portal)/results/page.tsx`:
- `requireRole(["client"])`; program clients are redirected to `/performance` (project clients stay).
- Reads `metric_definitions` (`id,key,label,unit,target`, `is_active=true`, ordered) + `metric_entries`
  (`definition_id,period,value_numeric,value_text`) — **RLS-scoped to the caller's own client**.
- `buildValueProof(defs, entries)` (`lib/value-proof.ts`) → `ValueProofBody`: wins, KPI cards w/ deltas,
  target pacing bars, trend charts, text notes. `hasData=false` ⇒ empty state.

**So `/results` reads the SAME `metric_definitions`/`metric_entries` store for project clients as
`/performance` does for program clients.** Anything staff put there for a project client shows up.

## How PROGRAM clients get KPIs
`20260621100000_program_driven_kpis.sql`: `metric_definitions` is the per-client **materialization**
of the resolved `program_kpis` catalog, kept in sync by a trigger on **`client_programs`**
(`sync_client_program_metrics`). Out-of-program KPIs are **deactivated, never deleted** (history-safe).

## The confirmed gap for PROJECT clients
- `20260615181456_onboarding_projects.sql`: `seed_new_client()` is **gated to program clients** — a
  project client gets **NO** checklist/roadmap/**metric_definition** rows.
- Project clients have **no `client_programs` row** ⇒ the sync trigger never fires ⇒ **zero KPIs
  auto-appear**. With nothing defined/entered, `/results` shows the empty state. ✔ real symptom.

## ⚠️ What ALREADY EXISTS (premise correction)
The brief says "there's no staff surface to define / enter / target." **That is not accurate — the
surface exists and is reachable + functional for project clients today:**
- **Staff Metrics tab is wired for project clients.** `workspace-chrome.tsx` lists a `Metrics` tab in
  the **project** tab set (`isProject` branch). `app/(portal)/clients/[clientId]/metrics/page.tsx` is
  **generic** (clientId-scoped, no `client_type` gate).
- **Define** — `DefinitionsManager`/`DefDialog` (`metrics-definitions-manager.tsx`): add/edit label,
  key (auto-slug), unit, reorder.
- **Target** — the DefDialog already has a **"Target (optional) — shown to the client as a pacing
  bar"** field (`metric_definitions.target`).
- **Activate/Deactivate** — `setMetricDefinitionActiveAction` (deactivate-not-delete) ✔.
- **Enter monthly numbers** — `MetricsWorkspace` "Enter data" grid + **CSV import**; upsert on
  `(definition_id, period)` (`saveMonthEntriesAction` / `commitCsvAction`).
- **Entry status already surfaced** — the page computes per-period `complete | in_progress | empty`.
- All writes are **staff-only + own-client-scoped**: every action in `lib/actions/metrics.ts` calls
  `requireClientAccess(clientId)` and filters `.eq("client_id", clientId)`. **No client write path.**
- **RLS read** — `metric_definitions_client_select` / `metric_entries_client_select` are client-scoped
  (NOT `client_type`-gated), so a project client reads its own active defs + entries → `/results`
  populates. (To be proven E2E in VERIFY.)

## Therefore — the REAL gaps to build (enhance, don't rebuild)
1. **No starter set.** Project clients face an empty definitions list (program clients auto-seed). The
   brief's "standardized blueprint + flexible modules": add a **one-click starter KPI set** for project
   clients (a template they then adjust), so staff aren't hand-building from zero.
2. **`lower_is_better` is hardcoded by key.** `value-proof.ts` `LOWER_IS_BETTER = {cost_per_lead,
   blended_cost_per_lead}` — a *custom* project KPI (e.g. `cost_per_booking`) can't be marked
   lower-is-better, so its pacing/wins read backwards. Add a **per-definition `lower_is_better` flag**
   (column + UI) and wire pacing/wins to it (falling back to the key set).
3. **Source key not settable.** `metric_definitions.source` exists (set by the program sync) but the
   DefDialog doesn't expose it — for project clients it stays null. Expose it (optional, integration-ready).
4. **Data-quality (defined-but-unentered).** A defined numeric KPI with no entries → `current=null`.
   Confirm `ValueProofBody` renders that gracefully ("—"/awaiting, not a broken-looking 0). Staff-side
   entry status already exists; surface it on the management tab for project clients too.
5. **Discoverability.** The tab is "Metrics"; staff may not connect it to the client's "Results".
   Clarify on the project-client surface that this drives `/results`.

## Plan
Do **not** duplicate the management surface. **Enhance** the existing metrics tab/actions:
add the per-def `lower_is_better` flag (migration + UI + value-proof wiring), the optional source key,
a **project-client starter set**, and the data-quality polish; then prove E2E that staff
define→enter→target populates the project client's `/results`. SACRED: staff-only writes,
own-client-scoped, client read-only, RLS suite stays green.
