# Track 5 · Section 2 — Threaded replies

**Status:** complete, awaiting owner review. **Branch:** `feat/messages-upgrade` (continues
from the approved Section 1 — see the branch note below). Section 2 of 6.

## Branch note
Section 1 is not merged to `main` yet, so S2 is the next **single commit** on
`feat/messages-upgrade` (each section = one reviewable commit). If you'd rather S1 land on
`main` first so S2 is a clean PR diff, say so and I'll rebase/split.

## Threading data model & inheritance

A message can reply to another via a nullable self-FK:

```
messages.parent_message_id  uuid  references messages(id)  on delete set null   -- NULL = top-level
idx_messages_parent  on messages(parent_message_id) where parent_message_id is not null
```

- **`NULL` parent = a top-level message** → renders exactly as before. Existing rows are
  untouched (the column defaults `NULL`). Additive + non-destructive; **RLS unchanged** — a
  reply is just a message, so the existing `messages` policies (admin all · team assigned ·
  client own `client_shared` + `deleted_at is null`) already scope it. No new policy, no
  client write path.
- **`ON DELETE SET NULL`** (the `tasks.source_message_id` precedent): the app only ever
  *soft*-deletes (`deleted_at`), so this fires only on a true row removal — and a reply then
  survives as top-level rather than cascade-vanishing.

**A reply inherits its parent's thread/visibility — structurally, not by trust:**
1. `post_message` sources the reply's denormalized `client_id` + `thread_type` from
   `v_thread` (the thread being posted to), **never** from the parent or caller. So the RLS
   columns are always the real thread's.
2. The RPC additionally requires `parent.thread_id = p_thread_id`, so a reply and its parent
   are **always in the same thread**. Same thread ⇒ same `thread_type`/`client_id` ⇒ same
   visibility. A cross-thread or internal-vs-shared parent is impossible.

## The boundary (this section's risk) — re-proven

A client can never reply into, or read replies within, the internal staff-only thread:
- **Reply with an INTERNAL parent into the client's own shared thread** → rejected:
  *"A reply must stay in the same thread as the message it replies to"* (thread mismatch).
  The parent row is read inside the `SECURITY DEFINER` body (bypassing RLS) **precisely so
  we can see an internal parent in order to REJECT it** — the client still never reads it.
- **Reply directly into the internal thread** → rejected by `can_access_thread` ("Not
  authorized for this thread").
- **Read** internal replies → the existing `messages_client_select` (`thread_type =
  'client_shared'`) returns nothing; the added `parent_message_id` SELECT column widens
  nothing.
- **Direct table INSERT** of a reply (bypassing the RPC) → `42501` (no client write policy).

## UI

One composer, **Slack-style 2-level threading** (reduced-motion-safe, no collapse animation):
- A **Reply** affordance on top-level messages → sets the reply target.
- A **"Replying to … ✕"** chip above the composer shows the target; ✕ cancels.
- Replies render **indented under their root** with an "↳ N repl{y/ies}" connector, in their
  own block; the main stream stays top-level only.
- **Orphan-safe:** a reply whose parent isn't in the visible set (soft-deleted or not loaded)
  promotes to top-level rather than vanishing; `rootOf` has a cycle guard.
- Optimistic + realtime: a sent reply appears live under its root; realtime INSERTs trigger
  an RLS-scoped refetch (the raw payload is never rendered), so a client never receives an
  internal reply.

## Verification (all green)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | green (TipTap still code-split) |
| `npm run test:rls` | **346 / 346** (was 339; +7 reply boundary/inheritance checks) |
| `npm run test:content` (S1 round-trip + XSS) | 24 / 24 |
| `node scripts/verify-s2.mjs` (E2E + boundary) | **14 / 14** |
| ESLint (S2 files) | clean¹ |

¹ The one remaining ESLint error is the **pre-existing** `set-state-in-effect` in the unchanged
search-debounce effect (present on `main`) — out of S2 scope.

**Four invariants re-confirmed:** client read-only, no direct client write (reply INSERT
denied 42501), **internal-thread boundary (the reply path — proven above)**, staff-only timer
(untouched).

Screenshots in this folder: `client_thread_with_replies`, `reply_composer`,
`staff_internal_reply` (internal thread, ↳ 2 replies, boundary banner), `mobile_threaded`,
`dark_threaded`.

## Notes / documented behavior
- Reply affordance is on **top-level** rows only (Slack-style); replying to a reply isn't
  offered in the UI, though the data model + server boundary would handle any same-thread
  parent.
- A reply reuses the existing `message` notification (it notifies the same thread
  participants), so the internal-never-client recipient rule already covers replies — no new
  notification type.
