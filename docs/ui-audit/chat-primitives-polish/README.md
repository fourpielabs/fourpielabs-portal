# Chat + primitives polish

Presentation only — no behavior/routing/data/auth-logic change. build green · tsc clean ·
eslint 0/0 · console clean (client `/messages` + `/settings`; staff messages/internal/
competitors/deliverables/reports).

## FIX 1 — Messages header + mobile placeholder
- **Removed the `PageHeader`** ("Messages" title + "Your conversation with the 4Pie Labs
  team." subtitle) from the client Messages page (`app/(portal)/messages/page.tsx`) — the
  surface is now just the chat window. (The staff messages page has no title header — only
  the functional Client/Internal thread tabs — so it's untouched.)
- **Mobile composer placeholder** (`components/messaging/conversation.tsx`): on
  `(pointer: coarse)` (via a new SSR-safe `lib/use-media-query.ts`) it shows only
  **"Write a message…"**; desktop keeps "Write a message… (markdown · @ to mention · ⌘↵ to
  send)". (Supersedes the prelaunch-polish mobile-composer item.) → `messages-mobile.png`

## FIX 2 — chat action buttons: visible, labeled, repositioned
Was: faint **icon-only** buttons, right-aligned (`ml-auto`, `text-ink-3`). Now: a
**left-aligned, labeled toolbar** on its own row above the input, with restrained amber
emphasis on hover/focus (`hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800`,
amber focus ring) — bordered chips that read at rest. Buttons changed:
| Button | Before | After |
|---|---|---|
| **Emoji** | icon-only, right | `😊 Emoji` chip, left |
| **Bold** | icon-only, right | `B Bold` chip, left |
| **Italic** | icon-only, right | `I Italic` chip, left |
| **Attach** | icon-only outline button, **bottom-right** next to Send | `📎 Attach` chip, **moved up into the left toolbar** |
| **Task** | icon-only, right (when applicable) | `⊹ Task` chip, left |
| **Send** | bottom-right (label) | **unchanged** — kept bottom-right (the conventional primary slot) |

→ `messages-desktop.png`, `composer-desktop.png`

## FIX 3 — invisible / inconsistent primitives + icons
- **Switch (the invisible toggle) — root cause + fix.** Radix `Switch` emits
  `data-state="checked|unchecked"`, but the component targeted `data-checked`/`data-unchecked`
  → the selector never matched → **`background: rgba(0,0,0,0)` (transparent) = invisible**
  (confirmed by inspecting the live DOM). Rebuilt to the official shadcn structure with the
  **correct `data-[state=checked]` selectors**, amber-600 when on / `border-strong` when off,
  a white thumb + drop shadow, an amber focus ring, standard sizing (`size` preserved). Now
  renders amber (computed `rgb(217,119,6)`), used across **13 call sites**. → before:
  `competitor-dialog-switch.png` (faint/transparent "Visible to client"); after:
  `settings-switches.png` (4 clear amber toggles).
- **Checkbox — new on-token primitive.** Created `components/ui/checkbox.tsx` (Radix +
  `data-[state=checked]` amber + lucide `Check`) and replaced the **2 bare native
  `<input type="checkbox">`** (`reports-manager` "Remove current PDF", `deliverable-dialog`
  "Remove current file") — the only off-system form controls. (No native radios exist.)
- **Icon standardization (lucide-react).** The app already imports all icons from lucide;
  the off-system glyphs were unicode:
  - **status-chip** `▲` (priority-high "tri") → lucide **`Triangle`** (filled). That component
    otherwise uses lucide `Check`/`Clock`/`EyeOff`, so the raw `▲` was the one inconsistency. ✓
  - **metric-delta** `▲▼` — **kept on purpose.** It's a settled KPI primitive where the glyph
    is the deliberate, internally-consistent, *colorblind-safe* indicator (glyph + color). Swapping
    it would restyle a surface settled over five phases; flagged here, happy to swap on request.

## Verify
build green · tsc clean · eslint 0/0 · console errors **NONE** across the affected surfaces ·
no behavior/routing/data change (header removal, placeholder string, toolbar layout, primitive
styling, and one glyph swap only).
