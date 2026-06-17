# The Diagnosis — Why the UI Reads as Unpolished

_Grounded in the 102 full-page screenshots in [./screens/](./screens/) (51 routes × 2
viewports, all 3 roles + both client types) and the live source. Screens are referenced as
`screens/{role}__{route}__{vp}.png`._

## The single biggest reason (read this first)

> **There is no shared page-shell system _inside_ the shells. Content width, page-header scale,
> section rhythm, and density are improvised on every route — so a genuinely strong token +
> component system renders as "a series of slightly-different admin screens" instead of one
> cohesive product.**

The shells (dark staff sidebar, client top-pill) are good. The tokens are good. The components
are mostly on-spec. But the moment you're _inside_ a page, each one hand-rolls its own
`max-w-*`, heading size, and spacing. On a 1440 screen this shows up as **content stretched
edge-to-edge with big empty gaps** (client Deliverables, project board) next to **narrow
floating columns** (Settings) next to **big confident hero layouts** (Dashboard, login). Fix the
page shell + spacing tokens and ~half of the "unpolished" feel disappears at once.

The app is **not** bad — `public__login__1440`, `client-program__dashboard__1440`, and
`client-program__performance__1440` are genuinely product-grade. The unpolish is concentrated in
secondary pages, dense staff editors, and wide-desktop layout.

---

## Findings by category

Severity: **High** = actively cheapens the product / breaks an affordance · **Med** = visible
inconsistency · **Low** = cosmetic or already-good.

### Typography & hierarchy
- **T1 · Med · Inconsistent page-header treatment per route.** Same role, three different
  headers: big Bricolage greeting (`client-program__dashboard__1440`), small centered "Your
  profile" (`client-program__settings__1440`), medium "Deliverables" (`client-program__deliverables__1440`).
  No `<PageHeader>` primitive. _Where:_ every `app/(portal)/**/page.tsx`.
- **T2 · Med · Tiny-text overload on dense staff surfaces.** The Metrics editor leans on
  10–11px overlines/captions for many controls at once → hard to scan
  (`admin__clients_P_metrics__1440`).
- **T3 · Low · Where used well, it's strong.** Bricolage greetings + `tabular-nums` metric
  numerals are on-brand. The problem is consistency, not craft.

### Spacing & rhythm
- **S1 · High · No spacing tokens / no content container → desktop stretch.** List & row pages
  span the full width with large empty mid-row gaps; title/desc hug the left, status/action hug
  the right (`client-program__deliverables__1440`). Reads as a thin web-app.
  _Where:_ no spacing scale in [globals.css](../../app/globals.css); ad-hoc Tailwind at call sites.
- **S2 · Med · Density is inverted vs the D4 intent.** Staff Metrics is _over-dense/cluttered_;
  client Settings/Deliverables are _over-sparse_. The "spacious client / compact staff" rule
  exists in the docs but isn't tokenized or enforced.
- **S3 · Med · Ragged card grids.** The project board is a 2-col grid with uneven card heights
  and an empty cell — no equal-height/row alignment (`client-project__dashboard__1440`).
- **S4 · Med · Under-filled wide layouts.** The staff Dashboard's client grid fills only the top
  third of a 1440 viewport; lots of dead space (`admin__dashboard__1440`).

### Color & contrast
- **C1 · Low · Token fine-drift from the docs** (bg `#f7f6f2` vs `#FAFAF8`; umber shadows). Cosmetic; see [drift.md](./drift.md) §1.
- **C2 · Low-Med · Amber CTA gradient top edge.** `--amber-cta` starts at `#c2670a` (lighter than
  amber-700), so white text on the button's top edge sits just under the locked
  "white-only-on-amber-700+" rule. _Where:_ [components/ui/button.tsx](../../components/ui/button.tsx#L17).
- **C3 · Low-Med · Broken resource on every authed page.** Console logs
  `Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR` once per role/viewport
  ([screens/_run-log.md](./screens/_run-log.md)) — likely an avatar/image requested over `https`
  (or `upgrade-insecure-requests` in the CSP upgrading an `http` asset on localhost). Invisible
  but a real failed request; worth tracing (could be a broken avatar in prod).

### Component consistency / drift
- **CC1 · High · Primary actions styled as the muted `secondary` variant → look disabled.** The
  Settings "Save changes" and "Save preferences" buttons use the gray-fill `secondary` variant
  and read as **disabled** (`client-program__settings__1440`). The most important action on the
  page looks inert. _Where:_ [components/settings/*](../../components/settings/) using
  `variant="secondary"`; the variant itself is fine ([button.tsx](../../components/ui/button.tsx#L20)).
- **CC2 · Med · `secondary` vs `outline` semantics mismatch the spec** (D2's white+border
  "secondary" = live `outline`; live `secondary` = gray fill). Inconsistent quiet-button choices
  app-wide. See [drift.md](./drift.md) §3.
- **CC3 · Med · Native `<input type=date>` / `type=file>` in otherwise-custom forms.** The lone
  "browser default" controls in deliverable/task dialogs + metrics CSV import — visually jarring
  next to the styled `Select`/`Input`.
- **CC4 · Low · Notification bell contradicts the design docs** (D1/D2 forbade notification UI).
  Not a bug — Phase-4 scope the docs never caught up with. Reconcile the docs, don't remove the bell.

### Data-viz quality
- **DV1 · Low (good) · The Performance chart is the strongest viz.** Amber area+line, windowed
  axis, `▲▼` delta tables (`client-program__performance__1440`). On-spec — keep as the bar.
- **DV2 · Med · The staff Metrics editor does too much on one screen.** Definitions list + entry
  grid + entry-status panel + a full **client-preview chart** (duplicating the client Performance
  page) stacked together = overload (`admin__clients_P_metrics__1440`).
- **DV3 · Med · KPI numerals are under-sized.** The client Dashboard KPI cards render numerals at
  roughly half the specced **44–48px Bricolage**; deltas are tiny. They should read bigger/more
  confident (`client-program__dashboard__1440`).

### Empty / loading / error states
- **E1 · Low (mostly good) · Empty states are friendly and on-voice** ("No projects yet — Add
  your first project and we'll take it from there", `client-project` empty variant). Skeleton
  route-loaders exist. Minor: the empty state floats inside one giant dashed rectangle on
  desktop — could be a tighter centered card.
- **E2 · Low · Sparse-data pages read under-filled** (staff Dashboard) rather than offering a
  next-action — adjacent to the S4 whitespace issue.

### Responsive behavior
- **R1 · Low (good) · Mobile (390) is solid.** Client dashboard stacks cleanly, KPI cards go
  2×2, staff sidebar→drawer, bottom tab bar present (`*__390` set).
- **R2 · Med · The _desktop_ is the weak breakpoint.** Layouts feel mobile-first then stretched,
  not re-composed for wide screens (the S1/S3/S4 cluster). Desktop needs max-width + multi-column
  intent, not just "the mobile layout, wider".

### Motion
- **M1 · Low · Motion is CSS-only and minimal.** Tasteful `.motion-*` utilities + checklist
  `tickPop` + reduced-motion safety exist, but there are no enter/stagger/page transitions and no
  micro-interactions beyond hover. The product feels **static**. This is the clearest "feels
  premium" upgrade lever (and the on-ramp to the auth-route 3D hero) — see [foundation.md](./foundation.md).

---

## Top 10 highest-leverage fixes (ranked)

| # | Fix | Kills | Why it's high-leverage |
|---|---|---|---|
| 1 | **Build `<PageHeader>` + `<PageContainer>` primitives** (one max-width, one header scale, one section rhythm) and adopt on every route | T1, S1, S4, R2 | One change, every page. Removes most of the "different screens" feel. |
| 2 | **Tokenize spacing + density** (client-spacious / staff-compact scales) and drive it from the container | S2, T2, rhythm | Makes the (good) D4 density intent actually enforced instead of guessed. |
| 3 | **Stop using the muted `secondary` variant for primary actions**; reconcile `secondary`↔`outline` to the D2 spec | CC1, CC2 | Save buttons currently look disabled — a real affordance bug on the highest-intent control. |
| 4 | **Constrain + grid the list/board pages** (equal-height cards, capped content width, real multi-column on desktop) | S1, S3, R2 | Fixes the stretched/ragged look on Deliverables, project board, dashboards. |
| 5 | **Right-size KPI/metric numerals** to the 44–48px Bricolage spec + larger deltas | DV3 | Cheap, high visual payoff on the client hero surface. |
| 6 | **Declutter the staff Metrics editor** (separate entry grid from the embedded client-preview chart; thin out tiny overlines) | DV2, T2, S2 | The densest, busiest staff screen → biggest staff-side polish gain. |
| 7 | **Replace native date/file inputs with the specced styled pickers** | CC3 | Removes the only "raw browser default" controls in custom forms. |
| 8 | **Trace & fix the `ERR_SSL_PROTOCOL_ERROR` resource** (avatar origin / CSP `upgrade-insecure-requests`) | C3 | Console hygiene now; possibly a broken avatar in prod. |
| 9 | **Reconcile the design docs to shipped reality** (Messages/Tasks/Notifications, gradient CTA, premium-surface tokens; retire the "no notifications" rule) | CC4, drift | Prevents the next builder from "fixing" intended drift; gives Phase-1 a true spec. |
| 10 | **Add `motion` for purposeful micro-interactions + page/enter transitions** (and stage the auth-route 3D hero) | M1 | The single biggest "feels premium" jump; foundation for the R3F auth hero. |

**Cluster insight:** fixes **1 + 2 + 4** are the same root cause (no layout/spacing system) and
should ship together as the first Phase-1 batch — they're ~60% of the perceived-quality gap.
