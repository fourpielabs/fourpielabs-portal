# Phase 1 — Before / After (layout & spacing system)

The strongest-changed routes, desktop @1440. `__BEFORE` = phase-0 baseline (pre-migration),
`__AFTER` = post-migration. Full after-set for every route is in
[../phase-1-after/](../phase-1-after/); the baseline is in [../screens/](../screens/).

| Route | What changed |
|---|---|
| `client-program__deliverables` | Edge-to-edge stretched rows → **constrained 1200 + 1→2-col equal-height card grid** (fixes #4/S1). |
| `client-project__dashboard` | Ragged 2-col project board → **equal-height cards** (the finding-#4 example). Greeting hero preserved. |
| `client-program__settings` | Narrow `max-w-xl` (576) ad-hoc column → **focused 720 + consistent PageHeader**. |
| `client-program__tasks` | Single-column list → **1→2-col equal-height grid**, consistent header. |
| `admin__admin_users` | Dense table cramped at 1152 → **wide 1440** with room to breathe. |
| `admin__clients_P` | Per-client workspace → **standardised container** (one width for all 16 tabs). |
| `client-program__dashboard` | **Hero preserved** (greeting + KPI band + dark report card unchanged) — proof the migration didn't flatten heroes. |
| `client-program__performance` | Heading → consistent PageHeader; **amber chart card preserved**; competitors equal-height. |

Verification: build green · `tsc` clean · 0 route redirects in the after-sweep (no behavior/
routing change) · adversarial before/after review across all 51 routes (see the chat report).
