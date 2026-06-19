# Bug Inventory — post-redesign sweep (fixes/bug-hunt)

Comprehensive map/triage across every route, both client types + staff + admin, on the live
redesign. Method: an automated explorer (`scripts/bug-hunt-explore.mjs`) logged in as each role,
visited every route, captured a screenshot + console errors + a blank/broken signal + targeted
DOM probes on the known suspects; then a visual review of the captures + source checks. Screens
in `docs/fixes/explore/`.

**Headline: the app is in very good shape.** 0 broken pages, 0 hydration mismatches, 0 console
errors (only the benign Firefox CSP "blocked eval" log, which predates the redesign), redirects
work, and the four invariants hold at the UI. The one real defect is a single conversion gap on
the booking CTA. The flagged suspects were all verified CORRECT.

## ⛔ BROKEN
_None._

## 🔴 HIGH
_None._
The explorer initially flagged two HIGH items; both were **test-timing artifacts, not bugs**,
confirmed by re-testing with proper waits:
- *Project-client `/program` `/performance` `/content` "not redirecting"* → they DO redirect to
  `/dashboard` (server guard `if (client.client_type === "project") redirect("/dashboard")` is
  present in each route; the 800 ms probe just measured before the streamed soft-redirect resolved).
- *Client task detail modal "not opening"* → it opens on both click and direct nav; the probe
  clicked during hydration.

## MEDIUM
**M1 — Booking CTA renders BLACK, not the Warm Obsidian amber CTA (conversion gap).**
- Route: client **Calls & Notes** (`/calls-notes`). Component: `components/booking/book-button.tsx`
  + `components/booking/cal-booking-button.tsx`.
- Cause: both import the OLD shadcn `Button` from `@/components/ui/button` and render its **default**
  variant (`--color-primary` = ink → black). Every other client CTA is amber (`EmberButton` /
  `variant="amber"`), so the two "Book" buttons stand out as an unconverted leftover.
- Scope: 3 `<Button>`s (the `dynamic` loading fallback, the legacy-URL external-link branch, and the
  Cal popup trigger). The dashboard "Book a call" is already amber (`EmberButton`) — unaffected.
- Fix: pass `variant="amber"` (the shadcn Button already ships this variant — AA white-on-amber).
  **Presentation only — the cal.com popup wiring (dynamic ssr:false import, getCalApi, metadata,
  onClick) is untouched, so the cal.com chunk isolation also holds.**

## 🟢 LOW / polish
_None material._

## ✅ Suspects checked — VERIFIED CORRECT (no change needed)
- **Client task detail modal** = the CONVERTED `TaskDetailDialog` (role="client"). Probe: 0
  `<select>` (no staff status/assignee leak), no "Time tracking"/timer, no "Visible to client"
  toggle; read-only **"Todo"** status chip; editable Title input + Description textarea + Subtasks +
  Save. Exactly the spec'd earned detail ("read-only status + editable title/description only, no
  stray controls"). Not a leftover.
- **Single shell per role** (no duplication): client = the redesign ember-glass **top pill nav**;
  staff/admin = the redesign **dark sidebar** (→ drawer on mobile). The old `components/shell/*`
  shells are unrouted (0 imports). No route reachable on an old light top-nav.
- **Messages** = headerless (no redundant page title) with the **left composer toolbar**
  (Emoji/Bold/Italic/Attach/Task), own-message bubbles right-aligned. ✓
- **Project + task status are READ-ONLY chips for clients** (project board cards show colored
  status chips, not staff dropdowns; client edits flow through the RPC dialog). ✓
- **No client timer** anywhere. ✓ **Internal-thread boundary** intact (client never reaches
  internal content). ✓
- Performance charts + count-up + month table, the WIDE metrics grid, the project-client staff
  workspace, dense admin tables, dashboards, documents — all render correctly + on-system.

## Considered, deliberately NOT changed (with why)
- **The light-mode dialog surface is white (`#ffffff`).** It looks a touch stark over the warm
  cream field, but it is **system-consistent** — every light-mode card (`rd-solid`) is `#fff` on
  the cream bg, and the Fluent `DialogSurface` matches them. "Warming" the dialog would be a global
  Fluent theme override, not a bug fix — out of scope for this phase.
- **The old shadcn feature bodies + shells** that are now dead/type-only (per the R6 cutover
  inventory) — left in place; deletion is the separate cleanup follow-up, not a bug.

## Precondition note
The stated precondition ("test-account deletion done, only real accounts remain") is **NOT met** —
the 4 demo users + 5 test clients are still present (no deletion was ever confirmed/executed). The
bug hunt USED those demo accounts as role/type fixtures, so this didn't block it. The cleanup still
awaits your confirmed KEEP/DELETE list.
