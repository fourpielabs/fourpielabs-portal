# Track 5 · Section 6 — (edited) tags + re-rich-ify edits  ·  **FINAL section**

**Status:** complete, awaiting owner review. **Branch:** `feat/messages-upgrade` (stacked on
S1–S5 as the final commit). **No migration** — S1 already added `messages.edited_at` and an
`edit_message(p_message_id, p_body, p_body_rich)` RPC; the gap was purely UI.

## What changed

### 1. Re-rich-ify edits (the S1-flagged seam, closed)
Editing used a plain textarea and **cleared `body_rich`** (messages rendered plain after an
edit). Now the inline edit uses the **same S1 TipTap composer**, pre-filled with the message's
**raw authored `body_rich`**, so **bold/italic/lists, @mentions, and S5 #-links all survive an
edit** (`body_rich` is updated, not cleared). `editMessageAction` already carried `p_body_rich`
(S1); the render path (sanitize + S5 per-viewer #-resolution) is shared with posted messages, so
edited content is sanitized + resolved identically.

- **`getMessageForEditAction(messageId)`** fetches the **raw** authored `body_rich` to pre-fill
  the editor — **author-only** (`data.author_id === me.id`, non-deleted), mirroring the
  `edit_message` gate. It adds **no** new read path: you can only pre-fill what you authored, so
  a client can't pull the raw (unresolved, title-bearing) `body_rich` of a staff message.
- `RichComposer` gained optional `initialHTML` / `autoFocus` / `showAttach` / `onCancel` so it
  reuses cleanly as the inline edit composer (Attach hidden, Cancel + Esc, pre-filled).

### 2. (edited) tag
A subtle italic **"(edited)"** with an "Edited <relative time>" tooltip shows on any edited
message the viewer can see — top-level **and** threaded replies; unedited messages show nothing.

### Boundary (small — editing is an existing gated path)
`edit_message` is unchanged (author-only + `can_access_thread`). An **internal** message's
`edited_at` / "(edited)" never reaches a client (the client never sees internal messages at all —
RLS), and the edit path adds no client read into internal edit state. A client still cannot edit
a message they couldn't before; editing into an internal thread is denied.

### Notable fix (found during verify)
A server action dispatched **directly from the dynamically-imported edit composer's Save handler
was silently severed** when that composer unmounted (the action's promise never settled, the edit
never persisted). Fix: `saveEdit` applies the optimistic update + closes the editor, then
**defers `editMessageAction` to a fresh task** (`setTimeout(0)`) so it dispatches from the
still-mounted conversation context. (Diagnosed by confirming the same action dispatched fine from
the Pencil handler but not the composer handler.)

## Verification (all green)

| Gate | Result |
|---|---|
| `tsc` / `build` | clean / green (TipTap still code-split) |
| `npm run test:rls` | **398 / 398** (was 396; +2 edit-with-body_rich checks) |
| `npm run test:content` (sanitize/XSS) | 28 / 28 |
| `node scripts/verify-s6.mjs` (E2E) | **14 / 14** |
| ESLint (S6 files) | clean¹ |

**E2E proves:** editing a rich message **preserves bold + the #-link chip** (DB confirms
`body_rich` updated with `<strong>` + the entity ref + the new text, `edited_at` set — not
cleared); **"(edited)"** shows on the edited message and **not** on the unedited one; an
**internal** message's edited state never reaches the client; an **edited `body_rich` with XSS is
inert** (no `<img>`/`<script>`, no execution). **RLS:** client edits own-shared with `body_rich`
(stored) / edit internal with `body_rich` **denied**. **Four invariants re-confirmed.**

¹ The one remaining ESLint error is the **pre-existing** `set-state-in-effect` in the unchanged
search-debounce effect (present on `main`) — out of S6 scope.

Screenshots: `editing_rich` (edit composer pre-filled with bold + #-link), `edited_tag` (the
edited message: bold + chip preserved + "(edited)"; the unedited one has no tag), `dark_edited`.

## Track 5 complete
All six sections (S1 editor · S2 threads · S3 reactions · S4 typing/receipts · S5 #-deep-links ·
S6 edits) are on `feat/messages-upgrade` as six reviewable commits. The internal-thread boundary
is re-proven on every new surface. **Next step (separate): reconcile the whole branch to `main`.**
