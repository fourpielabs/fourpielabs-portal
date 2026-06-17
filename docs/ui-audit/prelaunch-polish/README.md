# Pre-launch polish (the 4 first-impression SHOULD-FIX items)

Presentation/copy only — no behavior, routing, data, or auth-logic changes.
Branched from `main` (fc31524). Build green · tsc clean · eslint 0/0 · console clean on
the affected surfaces · three.js chunk still isolated.

## FIX 1 — `app/global-error.tsx`
Branded root-error boundary (replaces the root layout if *it* crashes). Self-contained:
renders its own `<html>`/`<body>`, all styling **inline** on the brand tokens (cream
`#f7f6f2` / charcoal `#18181b` / amber `#fef3c7`/`#b45309`), an inlined triangle-alert SVG
(zero import deps), and Try-again / Back-to-dashboard. Mirrors `app/error.tsx`. Like
`error.tsx`, it **never renders `error.message` or any stack** — proved by
`render-global-error.ts` (injected error text does not appear in the markup). Production-only
(dev shows Next's overlay). → `global-error.png`

## FIX 2 — one empty-state vocabulary
Converted the staff "header + dashed-box one-liner" empties to the `<EmptyState>` component
(icon + bold title + description), matching the client lists / `content-calendar` precedent.
Each tab's CTA stays in its toolbar; the redundant "No X yet." count-line is dropped when
empty. Files: `competitors-manager`, `reports-manager`, `updates-list`, `metrics-charts`
(client Performance chart), `client-reports` (client Performance reports). Content already
used `<EmptyState>`. → `staff-competitors-after.png`, `client-performance-after.png`
(before: `../first-impression/screens/staff-program-competitors.png`, `…/program-performance.png`)

## FIX 3 — warmer client Performance copy
"Charts appear once you have numeric metrics with monthly entries." →
**"Your performance charts show up here once we start tracking your numbers."**
(title "No performance data yet"). → `client-performance-after.png`

## FIX 4 — mobile message composer
Placeholder is conditional on `(pointer: coarse)` via `lib/use-media-query.ts`
(SSR-safe `useSyncExternalStore`): touch → **"Write a message…"**; desktop keeps
"Write a message… (markdown · @ to mention · ⌘↵ to send)". Behavior unchanged.
→ `m-messages-after-390.png` (before: `../first-impression/screens/m-program-messages.png`)
