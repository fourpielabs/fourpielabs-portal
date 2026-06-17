# Branch consolidation + integration

Several reviewed `ui-overhaul/*` branches were each cut from main in parallel; some
were never merged back, so the live Messages UI was stuck in the **pre-polish "before"
state** (the chat-primitives-polish branch was committed locally but never pushed/merged).
This branch (`ui-overhaul/integration`) gets all reviewed work into main safely.

## What was merged (in order, tsc + build green after each)
1. **chat-primitives-polish** (`980b610`, was local-only) — Messages header removal, mobile
   placeholder, left-aligned text-labeled amber chat buttons, Switch/Checkbox/icon fixes.
   Clean merge (main's booking work didn't touch the chat files).
2. project-status-lock / booking-backend / booking-frontend — **already in main** (no-ops).
3. **prelaunch-polish** (`3d691e3`) — global-error page, unified empty states, copy, mobile
   composer, `use-media-query`. Conflicts resolved:
   - `lib/use-media-query.ts` (add/add) — implementations **identical**; kept chat-primitives'.
   - `components/messaging/conversation.tsx` — both add the same `(pointer: coarse)` mobile
     placeholder; chat-primitives is the authoritative full version, resolved in its favor.

`proxy.ts` keeps **both** booking edits (webhook auth-matcher exclusion + cal.com CSP
allowlist). Full RLS suite: **214/214**.

## Proof — the three Messages changes render (12/12 checks, desktop + 390w touch mobile)
The mobile placeholder is gated on **`(pointer: coarse)`** (touch), so it only shows on a
real touch device — the screenshot uses touch emulation (validated: `coarse=true` on
mobile, `false` on desktop). This is the "doesn't fire on a real viewport" trap: a
desktop narrow window would NOT trigger it; a real phone does.

| Change | Desktop | Mobile 390w (touch) |
|---|---|---|
| (1) No "Messages" header/subtitle above the chat | ✓ | ✓ |
| (2) Mobile placeholder is ONLY "Write a message…" | n/a (full hint shown) | ✓ |
| (3) Chat buttons left-aligned, text-labeled, amber | ✓ | ✓ |

- `messages-desktop.png` — full hint placeholder; left-aligned labeled toolbar; no header.
- `messages-mobile-390.png` — short "Write a message…" placeholder; 😊 Emoji · **B** Bold ·
  *I* Italic · 📎 Attach · Task toolbar (left-aligned, labeled, amber-outlined); no header.
