# P0 — Content Audit (PROGRAM client experience). PROPOSAL — nothing rewritten yet.

Every client-facing string in the program-client experience, with a flag and a proposed
from→to rewrite. **No copy is changed in P0** — this is the rewrite plan for the owner's approval.

**Voice / positioning (the rewrite north star, from the pricing sheet):**
be the **obvious local choice**; **found first on Google, Maps, and ChatGPT**; **AEO layered on
strong SEO**; **market exclusivity** (one business per area); **90-day compounding** results.

**Flag legend:** `KEEP` = accurate + on-voice, leave it · `GENERIC` = vague/creative-agency filler,
rewrite to digital-marketing-specific · `TIGHTEN` = fine but can be sharper/on-brand.

---

## 1. Dashboard — `components/redesign/client/program-dashboard.tsx`

| Loc | Current | Flag | Proposed (from → to) |
|---|---|---|---|
| Hero greeting | `Welcome back, {firstName}.` | KEEP | — |
| Live pill | `Live · updated monthly` | KEEP | — |
| Review banner | `{n} deliverables are waiting on your review.` | KEEP | — |
| Section | `Start here` | KEEP | — |
| Section | `Your 90-day program` | TIGHTEN | → `Your 90-day growth plan` (names the outcome, not just the duration) |
| CTA | `View full program →` | KEEP | — |
| Section | `Latest deliverables` | KEEP | — |
| Empty | `Your deliverables show up here as we ship them.` | KEEP | — |
| Section | `Latest report` | KEEP | — |
| Empty | `Your first report lands after month 1.` | KEEP | — |
| Section | `Updates` | KEEP | — |
| Empty | `No updates yet.` | KEEP | — |
| Section | `Your partner` | KEEP | — |

---

## 2. Program tab — `components/redesign/client/program-body.tsx`

| Loc | Current | Flag | Proposed (from → to) |
|---|---|---|---|
| Title | `Your program` | KEEP | — |
| Subhead | `Everything your engagement covers.` | GENERIC | → `Everything we're doing to make you the obvious choice in your area.` |
| Section | `Your journey` | TIGHTEN | → `Your 90-day roadmap` (concrete; matches the milestone framing) |
| Empty | `Your roadmap will appear here shortly.` | KEEP | — |
| Section | `What's included` | KEEP | — |
| Section | `What's not included` | KEEP | — |
| Section | `Working together` | KEEP | — |

---

## 3. Performance — `components/redesign/keystones/performance.tsx`

| Loc | Current | Flag | Proposed (from → to) |
|---|---|---|---|
| Title | `Performance` | KEEP | — |
| Subhead | `Your numbers, live.` | TIGHTEN | → `The numbers that grow your business.` (ties metrics to outcome, not novelty) |
| Body | `Fresh metrics on the first of every month, straight from the sources we track. Glass stops at the door here — the data sits on solid, high-contrast surfaces.` | GENERIC | → `Fresh numbers on the 1st of every month — leads, calls, rankings, and AEO citations, straight from Google, Maps, and your ad accounts.` (the "glass stops at the door" line is internal design-speak leaking to clients — remove it) |
| Empty | `No performance data yet — your first numbers land after month one.` | KEEP | — |
| Section | `Month by month` | KEEP | — |
| Section | `Highlights by month` | KEEP | — |
| Section (social) | `What's working: ` | KEEP | — |
| Section (social) | `Our play` | KEEP | — |

---

## 4. Deliverables — `components/redesign/client/deliverables-list.tsx`

| Loc | Current | Flag | Proposed (from → to) |
|---|---|---|---|
| Subhead | `Everything we're creating for you.` | GENERIC | → `Everything we're building to win you more customers.` |
| Empty title | `Nothing here yet` | KEEP | — |
| Empty body | `Your deliverables will appear here as we ship them.` | KEEP | — |

---

## 5. Content calendar — `components/redesign/client/content-body.tsx`

| Loc | Current | Flag | Proposed (from → to) |
|---|---|---|---|
| Subhead | `What we're planning & publishing.` | TIGHTEN | → `The content we're publishing to get you found and cited.` (ties content to SEO/AEO outcome) |
| Empty | `Your content plan will show up here as we build it.` | KEEP | — |

---

## 6. Calls & Notes — `components/redesign/client/calls-notes-body.tsx`

| Loc | Current | Flag | Proposed (from → to) |
|---|---|---|---|
| Subhead | `Book time & catch up on sessions.` | KEEP | — |
| Empty | `No upcoming calls` / `Book one above and it'll appear here.` | KEEP | — |
| Empty | `Session recordings will appear here.` | KEEP | — |
| Empty | `Notes from our sessions will show up here.` | KEEP | — |

*(All Calls & Notes copy is functional + on-voice — KEEP.)*

---

## 7. Documents — `components/redesign/client/documents-body.tsx`

All KEEP (`Documents` / `Your agreements, forms & files.` / empty states) — neutral + clear.

---

## 8. Settings — `components/redesign/client/settings-body.tsx`

All KEEP — account/profile/notification copy is correct and should stay plain (not marketing voice).

---

## 9. Onboarding checklist (SEEDED) — `seed_on_client_insert.sql`

The titles are clear + action-oriented; mostly KEEP. Two tighten toward the positioning:

| Current | Flag | Proposed |
|---|---|---|
| `Confirm your ICP & offer clarity` | GENERIC | → `Confirm your ideal customer & offer` ("ICP" is agency jargon for a local-service owner) |
| `Automation setup` | TIGHTEN | → `Set up your lead automation` (says what it does) |

*(All other 13 checklist items: KEEP.)*

---

## 10. 90-day roadmap milestones (SEEDED) — `seed_on_client_insert.sql`

These are strong and already on-voice (AEO, cost-per-lead, compounding). KEEP all five. One optional
tighten so a Foundation client (no ads) doesn't see an ads milestone:

| Current title / desc | Flag | Note |
|---|---|---|
| `Discovery & Audit` — Deep-dive on your business, market, and current presence. | KEEP | — |
| `Foundation Build` — Set up the core systems, tracking, and assets. | KEEP | — |
| `AEO + Content Engine` — Launch the answer-engine optimization and content production. | KEEP | — |
| `Ads Launch + Optimization` — Stand up paid campaigns and optimize toward cost per lead. | TIGHTEN | only applies to Pipeline+ (ads). For Foundation-only clients, a later phase should swap this milestone for an SEO/AEO-compounding one. Flagged; tied to the program-catalog cutover, not a copy edit. |
| `Scale & Compound` — Double down on what works and compound the results. | KEEP | — |

---

## 11. Program labels — `lib/constants.ts` `PROGRAMS`

| Current | Flag | Proposed |
|---|---|---|
| `foundation → "Foundation"` | KEEP (pending owner call on "Core") | catalog `name`; see model.md open-Q #1 |
| `pipeline → "Pipeline"` | KEEP | — |
| `operating_system → "Operating System"` | KEEP | — |
| `pulse → "Pulse"` | KEEP | — |

*(Owner decision: pricing sheet uses "Core (Foundation)", "Pipeline (Growth Engine)", "Operating
System (Full Stack)", "Pulse (Social First)". If we want the parentheticals, they belong in the catalog
`tagline`, not the label.)*

---

## Summary

- **GENERIC (rewrite recommended): 5** — Program subhead, Performance body (+ the design-speak "glass
  stops at the door" leak), Deliverables subhead, the `ICP` checklist item, (Content subhead borderline).
- **TIGHTEN (optional sharpening): ~7** — "90-day program/journey", "Your numbers, live", Content
  subhead, "Automation setup", the Ads milestone (program-aware), Foundation-name decision.
- **KEEP: the large majority** — empty states, Calls/Documents/Settings, most onboarding + milestones.

The biggest single fix is the **Performance body** (it leaks internal design language to clients).
The highest-leverage on-voice rewrites are the three subheads (Program / Deliverables / Content) →
tie each surface to a concrete outcome (obvious choice / more customers / get found & cited).

**Nothing here is applied.** On approval these become string edits in the named components + a copy
update to the seed (new clients) ± a one-time data update for existing clients' seeded rows.
