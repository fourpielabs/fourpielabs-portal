# Track 5 · Section 5 — `#` deep-linking

**Status:** complete, awaiting owner review. **Branch:** `feat/messages-upgrade` (stacked on
S1–S4 as the next single commit). Section 5 of 6. **No migration** — entity RLS already scopes.

## The model: suggestion + link node + per-viewer resolution

Typing `#` links a **Project / Task / Deliverable** into chat. Three pieces:

1. **Suggestion (RLS-scoped, as the caller).** `searchLinkablesAction(clientId, query)`
   (`lib/actions/search.ts`, mirroring `globalSearchAction`) runs through the **user-scoped**
   Supabase client and queries `projects`/`tasks`/`deliverables` with `.eq("client_id", …)
   .ilike("title", …)`. **No SECURITY DEFINER, no view** — each table's own RLS does the
   filtering, so a client is only ever offered their **own visible** items (the
   `visible_to_client` gate excludes staff-only tasks/deliverables; a foreign `clientId` is
   RLS-bounded to zero). A grouped, keyboard-navigable picker (a 2nd TipTap Mention-based node,
   `char: '#'`, **distinct `PluginKey`** so it can't collide with the `@` suggestion).

2. **The link node.** Stored in `body_rich` as
   `<span class="rd-entity" data-type="TYPE" data-id="UUID">#title</span>`. The plaintext
   `body` uses a **generic** token (`renderText → "#type"`) — **no entity title ever lands in
   `body`**, so search/notifications/snippets can't leak a title even for a staff-only-into-shared
   link. The sanitizer (S1 allow-list) already permits the chip — no change.

3. **Resolution (per-viewer, RLS-scoped, DOM-based).** In `hydrateMessages` (the shared funnel
   for the thread read AND search), `resolveEntityLinks` parses `body_rich` with a **real DOM**
   (DOMPurify on jsdom) and rewrites **every** element carrying `class="rd-entity"` — regardless
   of attribute order, id format, extra attributes, or inner markup — by **clearing its children
   and attributes** and setting the result from a fresh, **caller-RLS-scoped** resolution:
   - **accessible** → a span with `data-href="{internal deep-link}"` + `role/tabindex`, the title
     set via `textContent` (auto-escaped) from the **DB**, never the author's stored text; the
     client turns it into navigation on click (guarded to `/`-prefixed internal routes);
   - **inaccessible** (cross-client, or a staff-only/internal item) →
     `<span class="rd-entity rd-entity--gone">#unavailable</span>` — **no title, no id, no href.**

   **A stored link cannot bypass access** — every chip is rewritten per-viewer, and an author's
   inner text/title is *always discarded*. This is the fix for the review's HIGH finding: an
   earlier regex resolver matched only TipTap's *canonical* serialization, so a hand-crafted
   non-canonical chip (reordered attrs, non-uuid id, inner markup) was skipped and its title
   leaked. The DOM rewrite closes that — proven by an E2E test that seeds non-canonical
   staff-only chips and asserts the client sees only "#unavailable".

## Deep-link routes
`task` has `?task=<id>` deep-focus (opens the task dialog) on both sides; `project`/`deliverable`
have no per-item focus → the chip links to the list route (client `/dashboard` · `/deliverables`;
staff `/clients/{id}/projects` · `/clients/{id}/deliverables`). Hrefs are built per viewer role.

## Verification (all green)

| Gate | Result |
|---|---|
| `tsc` / `build` | clean / green (TipTap still code-split) |
| `npm run test:rls` | **396 / 396** (was 387; +9 resolution-boundary checks) |
| `npm run test:content` (sanitize/XSS) | **28 / 28** (+4 entity-chip cases) |
| `node scripts/verify-s5.mjs` (E2E) | **17 / 17** (incl. the non-canonical-chip bypass closed) |
| ESLint (S5 files) | clean¹ |

**The boundary proof:** the client's `#` picker shows only their own visible projects/tasks/
deliverables (excludes staff-only + cross-client); a stored `#`-link to a staff-only item AND a
cross-client item both render **"#unavailable"** with no title; staff DO see the staff-only
title; a malicious entity title renders as **inert escaped text** (no `<img>`, no execution); the
stored `body` is generic (`#task`, no title). RLS proofs: client can resolve own visible
project/task/deliverable but **0 rows** for cross-client + staff-only (the same as-caller RLS that
scopes the picker). **Four invariants re-confirmed** (internal-thread boundary + cross-client
isolation on the new suggestion + resolution paths).

¹ The one remaining ESLint error is the **pre-existing** `set-state-in-effect` in the unchanged
search-debounce effect (present on `main`) — out of S5 scope.

Screenshots: `picker_own_only` (grouped picker, own-only + the resolved seeded message showing
"#unavailable"), `resolved_chip`, `client_unavailable`, `staff_picker`, `dark_deeplink`.

## Notes
- Generic plaintext (`renderText`) is the universal leak-closer for the `body` field; the rich
  chip carries the title only in `body_rich`, which is always re-resolved per-viewer.
- The optimistic send shows the author their own chip with the title before server resolution —
  safe, because the author can access the entity they just linked. No foreign title can appear via
  the optimistic path (you can only link your own accessible items).
