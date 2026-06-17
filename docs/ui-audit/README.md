# UI Audit — Phase 0 (Recon & Audit)

Read-only diagnosis of the 4Pie Labs client portal UI, on branch
`ui-overhaul/phase-0-audit`. **No app/component/style source was changed in this phase.** The
only non-doc side effect is an isolated demo project client in the DB (to enable project-client
screenshots) — documented + reversible in [screens/README.md](./screens/README.md).

## Deliverables

| File | What it is |
|---|---|
| [stack.md](./stack.md) | Exact versions + capabilities (Tailwind v4, React 19, shadcn/Radix, motion/three/React-Compiler). |
| [current-tokens.md](./current-tokens.md) | The **as-implemented** tokens (colors/fonts/spacing/radius/shadows/motion), with real values. |
| [drift.md](./drift.md) | Committed design system (D1/D2/D4) vs the live build — what drifted and why. |
| [findings.md](./findings.md) | **The diagnosis.** Prioritized by category + the ranked top-10 fixes. |
| [foundation.md](./foundation.md) | Phase-1 upgrade **proposal** (Tailwind/shadcn confirm, add `motion`, R3F auth hero, verify React Compiler) + risks. **Not executed.** |
| [layout-spec.md](./layout-spec.md) | **Phase 1, batch 1 (shipped):** the layout & spacing system — derived spec, tokens, `<PageContainer>`/`<PageHeader>` API, and the route→(width,density) map. Fixes findings #1/#2/#4. |
| [phase-1-before-after/](./phase-1-before-after/) | Before/after pairs for the strongest-changed routes; full after-set in `phase-1-after/`. |
| [phase-2-component-finish.md](./phase-2-component-finish.md) | **Phase 2 (shipped):** #5 metric numerals, #6 metrics-editor modes + per-tab width, #7 date/file pickers. |
| [phase-2-before-after/](./phase-2-before-after/) | Before/after + new-capability captures for phase 2. |
| [screens/](./screens/) | 102 full-page screenshots (51 routes × 1440/390, all roles + both client types) + [run log](./screens/_run-log.md) + [index](./screens/README.md). |
| [tools/](./tools/) | The throwaway scripts used to provision the demo project client + run the screenshot sweep. |

## The one-paragraph answer

The stack is **modern and healthy** (Next 16.2.9 · React 19.2.4 · Tailwind v4.3 · shadcn 4.11 on
Radix · React Compiler already on; no `motion`/R3F yet). The design **system is strong** and the
tokens are faithful. The UI reads as unpolished because **the system is applied unevenly**: there's
no shared page-shell/spacing primitive, so content width, page-header scale, and section rhythm are
improvised per route — strong hero surfaces (login, client dashboard, performance) next to stretched
or sparse secondary pages. The highest-leverage Phase-1 move is a `<PageHeader>`/`<PageContainer>`
+ spacing tokens (fixes ~60% of the feel at once), then the button-variant cleanup, then `motion`
and the R3F auth hero. Full ranking in [findings.md](./findings.md).
