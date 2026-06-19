# Redesign R6 — Parity, A11y, Performance, Cross-browser, Responsive & Cutover

The final phase. Integrated on `redesign/r5-motion` (the R5 tip, full R0→R5 lineage;
`redesign/foundation` is the old R0 label). Every acceptance gate below passed → cutover.

## GATE 1 — PARITY (the data/security layer is unchanged) ✅
- **RLS suite: `npm run test:rls` → 267/267 passed** (matches the pre-redesign total). The
  test file itself is byte-identical to main.
- **Data-layer diff vs main is EMPTY** — `git diff main..HEAD` over `supabase/`, `lib/actions/`,
  `lib/auth/`, `lib/supabase/`, `proxy.ts`, `lib/{audit,notifications,notification-recipients,
  notification-prefs,email,tasks,schemas,constants}.ts` shows **zero** changes. The 269 changed
  files are all presentation (components/, page wiring, docs, scripts). The rebuild was, provably,
  presentation only.
- **Four invariants re-proven** (UI, both client types + staff — `redesign-r3-complete-verify.mjs`
  11/11): internal-thread boundary (client redirected off the internal route + no internal
  surface), task-status lock (client task detail has no status control), admin guards (team
  blocked from /admin, client blocked from /clients), role visibility. project-status lock +
  no-direct-client-write are the RLS-enforced data-layer locks (in the 267) and `lib/actions`
  is identical to main.

## GATE 2 — ACCESSIBILITY ✅
- **Full AA: 1,111 worst-case ring-sampled samples, 0 fails** across client-program (336),
  client-project (150), staff (436), admin (189) — light + dark, over glass — plus the R4 auth
  card (28/0). **~1,139 total, 0 fails** (`redesign-r6-aa.mjs`; disabled controls WCAG-1.4.3-exempt).
- **Reduced-transparency + reduced-motion → solid + instant, app-wide** (R5; the globals.css
  opaque guarantee). **Keyboard/Tabster** (`redesign-r6-a11y.mjs`): 22 distinct interactive
  elements reachable in 25 tabs, visible focus on all, no trap; **modal traps focus (10/10 tabs
  inside) + Esc closes/restores**. **Decorative layers** (3D hero, AmbientField) are
  `aria-hidden` + `pointer-events:none`.

## GATE 3 — CROSS-BROWSER ✅ (`redesign-r6-crossbrowser.mjs` — 3/3 engines clean)
- **Chrome / Safari (WebKit) / Firefox**: **0 hydration mismatches** in any browser (Griffel SSR
  clean), the **backdrop-filter glass renders in all three** (incl. Safari/WebKit — no fallback
  needed), Fluent components render, the 3D gate falls to the static SVG hero headless, and route
  navigation works.
- Firefox logs benign **CSP "blocked eval"** console messages — the security CSP (in proxy.ts,
  unchanged from main) doing its job; nothing breaks. Per-browser captures in `crossbrowser/`.

## GATE 4 — PERFORMANCE ✅
- **three.js + cal.com still isolated** (`redesign-r4-bundle-proof.mjs` on the R6 build): each in
  exactly one async chunk, neither in the shared baseline, **0 references in any public route's
  initial HTML**.
- **Bundle delta vs main (honest):** the **shared baseline is byte-identical — 557 kB on both**
  (Fluent v9 + Griffel are route-level chunks, NOT in the baseline → the data app's per-route
  floor did not grow). Total static JS 4,256 kB (main) → 6,232 kB (redesign): +1,976 kB spread
  across lazy/route chunks — incl. the isolated three.js (~1 MB), the `/redesign-preview`
  keystones, cal, and the Fluent route chunks; none of it shipped to a route that doesn't use it.
  Chunks 83 → 124.
- **Lighthouse `/login` (identical 4× mobile throttle), redesign vs main:** perf **58 vs 50**,
  a11y **100 vs 100**, CLS **0 vs 0.18**, TBT **1,020 ms vs 1,250 ms**, LCP 5.3 s vs 4.8 s
  (+0.5 s, the only minor regression; overall score improved). a11y is 100 on both.
- **backdrop-filter scroll cost contained by design:** glass is only on chrome / overlays /
  summary-with-scrim; dense surfaces (tables, lists, forms, boards) are `rd-solid` (no
  backdrop-filter) — confirmed structurally across R2–R5.

## GATE 5 — RESPONSIVE ✅ (`redesign-r6-responsive.mjs` — 22 captures → `responsive/`)
390 / 768 / 1024 / 1440 verified across: client bottom-tab + 2-col KPI band (program +
project), staff sidebar→hamburger-drawer + horizontal tab scroll, the WIDE metrics grid, the
list/board grids, the auth static fallback, the dual-thread messaging surface. Layouts adapt
correctly at every breakpoint.

## Cutover prep
- **No env/secret changes required** — zero new `process.env` usage in the redesign; Fluent /
  Griffel / three are build-time/bundled. main stays deployable on the existing env.
- **Dead-code inventory (kept — cleanup is a follow-up):** fully unimported (dead bodies) —
  `components/shell/` (old shells), `components/{checklist,notes,reports,files,admin}/`; kept only
  for TYPE re-exports — `components/{deliverables,content,competitors,calls,updates,metrics,
  program,clients}/`; still actively used — `components/tasks/{client-task-dialog,client-task-board,
  task-checklist}` + `components/ui/*` leaves (DatePicker, FileDropzone, PersonAvatar, Skeleton,
  ConfirmDeleteDialog, date-range-picker, Markdown, sonner).

## CUTOVER ✅ (local — main updated, ready to deploy)
- **Fast-forward merge** `redesign/r5-motion → main` (main was an ancestor → clean ff, no merge
  commit). The full redesign R0→R6 is now on `main`.
- **Post-merge build: GREEN + tsc clean.** (The first attempt hit the known intermittent
  Turbopack `failed to receive message` flake — NOT a code error; `rm -rf .next node_modules/.cache`
  + rebuild → ✓ compiled in 46s. The identical tree built green repeatedly on the redesign branch.)
- **Post-merge RLS on main: 267/267.**
- **Post-merge isolation on main: PASS** — three.js + cal.com each in one async chunk, neither in
  the shared baseline, 0 refs in `/login` initial HTML (the merge did not reshuffle them into the
  baseline).
- **No env/secret changes required** — main is deployable on the existing environment.

**NOT pushed to origin.** The local merge is complete + verified, but pushing to `origin/main`
triggers the Vercel production deploy — an outward-facing action held for explicit go-ahead.
