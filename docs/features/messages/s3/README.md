# Track 5 · Section 3 — Emoji reactions

**Status:** complete, awaiting owner review. **Branch:** `feat/messages-upgrade` (stacked on
S1 editor + S2 threads as the next single commit). Section 3 of 6.

## Reactions data model & structural inheritance

```
message_reactions(
  id, message_id → messages (on delete cascade),
  thread_id → threads,        -- denorm: thread-scoped reads
  client_id → clients,        -- denorm FROM the message: RLS
  thread_type thread_type,     -- denorm FROM the message: RLS
  user_id → profiles, emoji text check(len 1..24), created_at,
  unique (message_id, user_id, emoji)   -- no double-react; multiple distinct emojis OK
)
```

A reaction **inherits its message's visibility structurally** (like an S2 reply): the boundary
columns `client_id` + `thread_type` are copied **from the message** inside the
`SECURITY DEFINER` RPC — never from caller input — so the reaction's RLS is a pure-column
mirror of the message's. Additive migration; existing messages unaffected.

## Both leaks closed

**(1) WRITE.** `toggle_reaction(p_message_id, p_emoji)` re-reads the message's real
`thread_type`/`client_id` and gates on `app.can_access_thread(...)`. A client reacting to an
internal message (even passing its id) → *"Not authorized for this message"*. There is **no
client write policy** on `message_reactions`, so a direct INSERT/UPDATE/DELETE is `42501` —
the RPC is the sole write path.

**(2) READ / EXISTENCE.** The client SELECT policy is
`client_id = my_client_id() and thread_type = 'client_shared'`, mirroring `messages_client_select`.
An internal reaction carries `thread_type='internal'` → a client can never SELECT or COUNT it.
**The existence of an internal reaction cannot leak the existence of an internal message.**

## Realtime — the researched design choice (the third leak vector)

`message_reactions` is **deliberately NOT in `supabase_realtime`.** Supabase does **not**
RLS-filter `DELETE` events — per the docs, *"RLS policies are not applied to DELETE statements
… the old record contains only the primary key(s)"* even with replica identity full. So
subscribing a client to reaction events would leak the existence of un-react (DELETE) events
regardless of policy.

Instead, **`toggle_reaction` bumps the parent message's `updated_at`**, which fires the
**existing `messages` UPDATE realtime event** — and UPDATE events **are** RLS-filtered (the new
row carries `client_id`/`thread_type`). A reaction on an internal message bumps an internal
message → that UPDATE is RLS-denied to clients → a client receives **nothing** (no event, no
id, no existence leak). Subscribers then refetch reactions via the RLS-scoped action (the raw
payload is never rendered). The boundary holds on the realtime path too — verified end-to-end.

## UI

- **Hover-react bar** (revealed on hover/focus-within; always-on for touch via
  `@media (hover:none)`; reduced-motion-safe): quick `👍` `✅` + a `+` emoji picker popover.
- **Reaction chips** under each message: emoji + count, the viewer's own reaction highlighted
  (amber, `aria-pressed`), click to toggle, tooltip = who reacted. Works on **top-level rows
  AND threaded replies** (same `renderRow`).
- **Optimistic** toggle with a **generation guard** (a slow/in-flight refetch can't clobber a
  newer optimistic toggle); **live** for everyone via the message-bump → messages-UPDATE →
  RLS-scoped reaction refetch.

## Verification (all green)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | green (TipTap still code-split) |
| `npm run test:rls` | **364 / 364** (was 346; +18 reaction checks) |
| `node scripts/verify-s3.mjs` (E2E + boundary) | **17 / 17** |
| ESLint (S3 files) | clean¹ |

¹ The one remaining ESLint error is the **pre-existing** `set-state-in-effect` in the unchanged
search-debounce effect (present on `main`) — out of S3 scope.

**RLS proofs:** client reads own shared reaction · client CANNOT read/count internal reactions
(0 rows — existence boundary) · client react to internal/cross-client DENIED · direct
INSERT/DELETE `42501` · `UNIQUE` prevents double-react (`23505`) · unassigned-team + anon denied.
**Four invariants re-confirmed.**

Screenshots: `hover_react`, `reaction_chips`, `reply_reaction`, `emoji_picker`,
`staff_internal_reaction` (🦄+👍 behind the boundary banner), `mobile_reactions`, `dark_reactions`.

## Notes
- Reactions are kept in **separate client state keyed by message id** (not on `ThreadMessage`),
  so reaction churn doesn't re-render the message array and the incremental message sync is
  untouched.
- No reaction notifications (out of scope; the spec covers chips + realtime only).
