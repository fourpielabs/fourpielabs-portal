# Track 5 · Section 4 — Read receipts + typing indicators

**Status:** complete, awaiting owner review. **Branch:** `feat/messages-upgrade` (stacked on
S1+S2+S3 as the next single commit). Section 4 of 6 — **the most realtime-dangerous section.**

## The realtime transport decision (researched)

Typing/seen are LIVE signals. The hard requirement: a client must be **physically unable** to
receive ANY signal about the staff-only internal thread. A research pass (Supabase docs) settled
the transport:

- **Presence & Broadcast do NOT enforce table RLS.** They are peer fan-out keyed only on the
  channel *topic string* — every subscriber on a topic receives every event. *"For public
  channels, any user can subscribe… send and receive messages."* → **boundary-unsafe.**
- **Realtime Authorization (private channels)** *can* gate per-topic join, but only by flipping
  the whole project to private-channels-only + authoring `realtime.messages` topic-RLS — a new,
  differently-shaped policy class (exactly where this app has historically been bitten by
  NULL/parse bugs).
- **postgres_changes INSERT/UPDATE events ARE RLS-filtered per-subscriber** (the app already
  trusts this for messages — 4c). **DELETE is NOT** (and isn't filterable) — the S3 gotcha.

**Decision: route BOTH typing and seen through RLS-filtered postgres_changes table events**,
INSERT/UPDATE-only — the same proven boundary the app already audits. No presence, no broadcast.

## The boundary guarantee (why a client cannot receive internal typing/seen)

Four layers, all structural:
1. **The client never knows the internal thread id** — `threads_client_select` is shared-only,
   so the client page only ever subscribes with its own `client_shared` thread id.
2. **Column-only RLS mirrors messages** — `typing_states` and `thread_reads` carry denormalized
   `client_id` + `thread_type` (copied *from the thread* in the SECURITY DEFINER RPC, never
   caller input); the client SELECT policy is `client_id = my_client_id() and thread_type =
   'client_shared'`. An internal row is un-SELECTable → un-receivable, even if a client crafted
   an internal thread_id subscription.
3. **INSERT/UPDATE only** — typing expires by *timestamp* (a stale row is ignored client-side; no
   DELETE), and seen is an *upsert* on `thread_reads`. The not-RLS-filtered DELETE path is never
   used on the boundary, and the subscriptions only listen for INSERT/UPDATE.
4. **The raw payload is never rendered** — each event triggers an RLS-scoped refetch
   (`getActiveTypersAction` / `getThreadReadsAction`), so even a hypothetical stray event surfaces
   nothing internal (the proven third boundary layer).

## What was built

- **Typing indicators** — `typing_states` table + `set_typing(thread_id)` RPC (gates
  `can_access_thread`, upsert). The composer's TipTap `onUpdate` → a debounced `onType` (≤1
  signal / 2.5s). The indicator (“X is typing…”, animated dots, `aria-live`, reduced-motion-safe)
  shows others typing in *this* thread; a 6s window + a 3s re-poll expire it.
- **Read receipts** — reuse the existing `thread_reads.last_read_at` (written by
  `mark_thread_read` on thread open + on each new message). `thread_reads` gained denormalized
  boundary columns + a **broadened SELECT** so co-participants see each other's seen-state *on
  threads they may access* (a client sees its own + staff's **shared** reads; never internal). A
  subtle “👁 Seen by … · time” marker renders under the viewer's **last own** message.

## Verification (all green)

| Gate | Result |
|---|---|
| `tsc` / `build` | clean / green (TipTap still code-split) |
| `npm run test:rls` | **387 / 387** (was 365; +22 typing/seen checks) |
| `node scripts/verify-s4.mjs` (concurrent realtime) | **8 / 8** |
| ESLint (S4 files) | clean¹ |

**The realtime-leak proof (E2E, two concurrent contexts):** while staff genuinely type in the
**internal** thread (an internal `typing_states` row is confirmed to exist server-side), the
client watching their shared thread receives **zero** typing signal — *and* the positive case
(staff typing in the shared thread → client sees it live) passes, so the negative isn't a no-op.
Read receipts work both directions on the shared thread.

**RLS proofs:** client reads own-shared typing/seen · client CANNOT read/count internal
typing or seen (0 rows) · client sees NO internal rows at all · `set_typing` internal/cross
DENIED · direct INSERT `42501` · staff read/signal both threads (assigned) · unassigned + anon
denied · `thread_reads` broadened but still never exposes internal. **Four invariants
re-confirmed.**

¹ The one remaining ESLint error is the **pre-existing** `set-state-in-effect` in the unchanged
search-debounce effect (present on `main`) — out of S4 scope.

Screenshots: `typing_indicator` (client sees staff typing), `read_receipt` (“Seen by …”),
`client_no_internal_typing` (client shows nothing while staff types internally), `dark_presence`.

## Notes
- Typing is DB-backed (one upsert ≤ every 2.5s per active typer) rather than ephemeral
  presence — a deliberate trade (a few small writes) for the proven RLS boundary. A future
  service-role cron could prune stale `typing_states` rows; it's unnecessary for correctness
  (the 6s window ignores them) and must never be a client-visible DELETE.
