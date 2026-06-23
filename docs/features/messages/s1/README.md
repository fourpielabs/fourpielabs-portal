# Track 5 · Section 1 — WYSIWYG message editor (TipTap)

**Status:** complete, awaiting owner review. **Branch:** `feat/messages-upgrade`.
This is Section 1 of 6 (S2–S6 not started — they begin only after the editor is approved).

## What changed

The markdown `<textarea>` composer was replaced with a **TipTap WYSIWYG editor**.
Bold / Italic / List / @mention / emoji format **instantly** in place — no more
asterisks-on-send. Everything that worked before still works: **@mentions**, **⌘↵ to
send**, the **send / attachment / validation** flow, the headerless surface, and the
left-aligned composer toolbar.

### Files
- `components/redesign/messaging/rich-composer.tsx` — the TipTap composer (code-split).
  Toolbar active-states use **`useEditorState`** so the buttons light up with the cursor
  (`aria-pressed`). Mentions use the TipTap Mention extension over the same participant
  list; the suggestion plugin's non-React callbacks bridge to React via refs.
- `components/redesign/messaging/rich-message.tsx` — renders a message: rich HTML when
  present (sanitized), else the legacy markdown body.
- `lib/messaging/sanitize.ts` — the sanitize allow-list + the content discriminator,
  shared by the renderer and the round-trip test (single source of truth).
- `components/redesign/client/conversation.tsx` — feed render via `RichMessage`,
  the rebuilt **task bubble**, and the composer wired up. TipTap is loaded with
  `next/dynamic({ ssr: false })` so the heavy editor chunk stays out of the entry bundle.
- `lib/actions/messages.ts` — `postMessageAction` / `editMessageAction` carry `bodyRich`;
  `getThreadMessagesAction` / `searchThreadMessagesAction` select it and hydrate the
  linked task; **`createTaskFromChatAction`** posts the source message + creates the task.
- `supabase/migrations/20260623110000_message_rich.sql` — adds `messages.body_rich`;
  `post_message` / `edit_message` re-created with new **defaulted** `p_body_rich` params
  (existing 2-arg callers unbroken). Additive only — RLS unchanged.

## Content-format migration (the risky part)

Two columns coexist, **no history is re-encoded**:
- `messages.body` — plaintext (search, notifications, snippets, optimistic UI).
- `messages.body_rich` — nullable TipTap HTML. **`null` ⇒ render the legacy markdown
  `body` via `<Markdown>`.** New messages store both; old messages keep `body_rich = null`
  and render exactly as before.

Rendered HTML is sanitized with a strict allow-list (DOMPurify) — only the tags/attrs
TipTap emits survive; `<script>`, `<img onerror>`, `<iframe>`, `on*` handlers, and
`javascript:` URIs are stripped. See `scripts/test-content-format.ts`.

## Task bubble (rebuilt)

A message with a linked task (`tasks.source_message_id = message.id`) renders as a card
in the feed (deep-links to the task). "Create a task" on the composer posts the draft as a
message and creates a task linked to it through the **existing gated paths**:
- client → `create_task` RPC (assignee circle + own `client_shared` source enforced);
- staff → `staffCreateTaskAction` with `visible_to_client` **derived from the real
  thread_type** (un-spoofable), so a task made from an **internal** message is forced
  invisible to the client.

## Internal-thread boundary — re-proven for the new surfaces

A client cannot see, post to, or create a task from the internal thread through any new
path. Proven at the data layer (RLS suite incl. rich-path checks) and end-to-end:
- internal messages never render for the client;
- a staff task from an internal message is `visible_to_client = false`;
- a client cannot see that internal-sourced task in `/tasks`.

## Verification (all green)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | green (TipTap code-split) |
| `npm run test:rls` | **339 / 339** |
| `npm run test:content` (round-trip + XSS) | **24 / 24** |
| `node scripts/verify-s1.mjs` (E2E + boundary) | **17 / 17** |
| ESLint (S1 files) | clean¹ |

¹ One pre-existing `set-state-in-effect` warning lives in the unchanged search-debounce
effect (present on `main`) — out of S1 scope.

Screenshots in this folder: `editor_and_old_message`, `wysiwyg_bold`, `mention`,
`task_bubble`, `dark_editor`, `mobile_editor`, `staff_internal_composer`.

## Known / documented behavior
- **Inline edit** uses a plain textarea; saving an edit clears `body_rich` (the message
  renders as plain after an edit). Re-rich-ifying edits is a candidate for a later section.
