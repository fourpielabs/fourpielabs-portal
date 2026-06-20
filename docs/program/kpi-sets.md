# P0 — Per-Program KPI Sets (PROPOSAL). PROGRAM clients only.

Concrete KPI set per program, mapped to the **existing manual metric grid** (`metric_definitions` →
`metric_entries`, team enters monthly) and **integration-ready** via a stable `key` + a `source` key
(manual today; the named API later). **Nothing applied** — this is the catalog the proposed migration
seeds into `program_kpis`.

**How it maps to today's grid:** each KPI = one `metric_definitions` row (`key`, `label`, `unit`).
The team types the value into the monthly grid exactly as now. The new `source` column (proposed) tags
where the number *will* come from once integrated — so a future Google Ads/GSC/Meta/GA4 sync writes the
same `metric_entries` row by `(key, source)` with **zero re-architecture**. Stacking applies: a tier's
client gets its own set **plus every lower core tier's** (Pulse adds its set on top if assigned).

**Unit** values reuse the existing `metric_unit` enum: `number | currency | percent | text`.

---

## The defect this fixes

Today `seed_new_client()` gives **all three core tiers the identical SEO set — including `ad_spend`,
`ad_conversions`, `cost_per_lead`** — even **Foundation**, which sells no ads. So a Foundation client's
Performance page shows empty ad columns forever. The program-aware sets below scope ad KPIs to the tiers
that actually run ads (Pipeline+).

---

## Foundation (Core) — local visibility, no ads

The "get found first" set: SEO rankings, GBP, AEO, organic. **No ad metrics.**

| key | label | unit | source (future) | now |
|---|---|---|---|---|
| `leads` | Leads | number | manual | manual |
| `gbp_calls` | GBP Calls | number | gbp | manual |
| `top3_keywords` | Top-3 Keywords | number | gsc | manual |
| `map_pack_keywords` | Map-Pack Keywords | number | gbp | manual |
| `aeo_citations` | AEO Citations | number | manual | manual |
| `organic_traffic` | Organic Traffic | number | ga4 | manual |
| `key_learning` | Key Learning | text | manual | manual |

---

## Pipeline (Growth Engine) — Foundation + paid search

Stacks the Foundation set, **adds paid-search KPIs** (Google Ads + call tracking + cost per lead).

Inherited: all of Foundation. **Added:**

| key | label | unit | source (future) | now |
|---|---|---|---|---|
| `ad_spend` | Ad Spend | currency | google_ads | manual |
| `ad_conversions` | Ad Conversions | number | google_ads | manual |
| `cost_per_lead` | Cost per Lead | currency | manual (derived) | manual |
| `calls_tracked` | Calls Tracked | number | manual (call-tracking) | manual |

*(Resolved Pipeline set = Foundation 7 + these 4 = 11 KPIs.)*

---

## Operating System (Full Stack) — Pipeline + multi-channel & blended

Stacks Pipeline, **adds the cross-channel / revenue view** (multi-channel ads + dashboard + CRM mean
the client now cares about blended economics, not single-channel).

Inherited: all of Pipeline (→ Foundation + paid search). **Added:**

| key | label | unit | source (future) | now |
|---|---|---|---|---|
| `blended_cost_per_lead` | Blended Cost per Lead | currency | manual (derived) | manual |
| `pipeline_value` | Pipeline Value | currency | manual (CRM) | manual |
| `revenue_attributed` | Revenue Attributed | currency | manual (CRM) | manual |

*(Resolved OS set = Pipeline 11 + these 3 = 14 KPIs. `cost_per_lead` stays single-channel; `blended_*`
adds the cross-channel roll-up.)*

---

## Pulse (Social First) — parallel set (added on top of any core tier, or standalone)

The existing social set (unchanged keys, so existing Pulse clients' data carries over), tagged with
`source` for the future Meta/TikTok sync. If a client is **Pipeline + Pulse**, they see the Pipeline
set **and** this set.

| key | label | unit | source (future) | now |
|---|---|---|---|---|
| `total_views` | Total Views | number | meta_ads | manual |
| `follower_count` | Follower Count | number | meta_ads | manual |
| `follower_growth` | Follower Growth | number | meta_ads | manual |
| `profile_visits` | Profile Visits | number | meta_ads | manual |
| `inbound_dms` | Inbound DMs | number | manual | manual |
| `sales_calls_booked` | Sales Calls Booked | number | manual | manual |
| `new_clients_closed` | New Clients Closed | number | manual | manual |
| `revenue_this_month` | Revenue This Month | currency | manual | manual |
| `best_performing_post` | Best Performing Post | text | manual | manual |
| `hook_that_worked_best` | Hook That Worked Best | text | manual | manual |
| `key_learning` | Key Learning | text | manual | manual |

---

## Resolution examples

| Client assignment | Resolved KPI set |
|---|---|
| Foundation | Foundation (7) |
| Pipeline | Foundation + Pipeline (11) |
| Operating System | Foundation + Pipeline + OS (14) |
| Pulse (standalone) | Pulse (11) |
| Pipeline + Pulse | Foundation + Pipeline (11) + Pulse (11) = 22 |

De-dupe note: `key_learning` exists in both the core stack and Pulse — the resolver should de-dupe by
`key`, keeping the lowest `sort_order` (one "Key Learning" row, not two).

---

## Integration roadmap (why `source` matters now)

`source` is set today but every value is entered **manually** through the existing grid — no behavior
change. When an integration lands (a v1 non-goal, but this is the documented future point):

1. A sync job pulls the metric from the named API (e.g. `google_ads` → `ad_spend`).
2. It upserts `metric_entries` for the matching `metric_definitions` row (by `key`) for `(definition_id,
   period)` — the **same row the team types into today**.
3. `source` distinguishes auto-populated KPIs from manual ones in the UI (e.g. a "synced" badge) and
   lets the team still override.

Source keys used: `manual`, `gbp` (Google Business Profile), `gsc` (Search Console), `google_ads`,
`meta_ads`, `ga4` (GA4). These line up with the existing `content_platform` enum values (`google_ads`,
`meta_ads`) and the `metric_entries` shape — no new infra needed when integration day comes.

---

## Wiring note (later phase, not P0)

When reads cut over to the catalog (model.md §6), `seed_new_client()` is replaced by a
**resolve-from-catalog** step: on assignment, ensure a `metric_definitions` row exists for each resolved
`program_kpis.key` (carrying its `label`, `unit`, `source`). Existing clients keep their current rows;
the only net change is Foundation clients **lose the three empty ad columns** and gain nothing they don't
use. This is a data reconciliation to plan in P1, not a P0 change.
