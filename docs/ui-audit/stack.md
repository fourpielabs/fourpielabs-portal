# Stack Inventory — UI Audit (Phase 0)

_Generated on branch `ui-overhaul/phase-0-audit`. Versions are the **resolved/installed**
values from `npm ls` (not just the `package.json` ranges)._

## Core framework & language

| Package | `package.json` range | Installed | Notes |
|---|---|---|---|
| `next` | `16.2.9` | **16.2.9** | App Router. Next **16** (not 15). `middleware.ts` renamed to `proxy.ts`. |
| `react` | `19.2.4` | **19.2.4** | **React 19 — yes.** |
| `react-dom` | `19.2.4` | **19.2.4** | |
| `typescript` | `^5` | **5.9.3** | |
| `eslint` / `eslint-config-next` | `^9` / `16.2.9` | 9.x / 16.2.9 | flat config (`eslint.config.mjs`) |

## Styling

| Package | Range | Installed | Notes |
|---|---|---|---|
| `tailwindcss` | `^4` | **4.3.0** | **Tailwind v4 — yes.** CSS-first config. |
| `@tailwindcss/postcss` | `^4` | **4.3.0** | The v4 PostCSS plugin (only plugin in `postcss.config.mjs`). |
| `tw-animate-css` | `^1.4.0` | 1.4.x | Tailwind animation utilities (imported in `globals.css`). |

**Tailwind v4 confirmed.** There is **no `tailwind.config.{js,ts}`** — configuration is
CSS-first via the `@theme { … }` block in [app/globals.css](../../app/globals.css). `@import
"tailwindcss";` is the entry. `components.json` → `tailwind.config: ""` (empty, correct for v4).

## shadcn/ui & UI primitives

| Item | Value |
|---|---|
| `shadcn` (CLI) | **4.11.0** |
| `components.json` style | **`radix-nova`** |
| Base color | `neutral` · CSS variables: `true` · prefix: none |
| Icon library | `lucide` (`lucide-react` **1.17.0**) |
| Primitive library | **Radix UI** — the unified **`radix-ui` 1.5.0** meta-package (re-exports all `@radix-ui/react-*`). **Not Base UI.** |

`components/ui/*.tsx` import primitives from the unified `radix-ui` package (e.g.
`import { Slot } from "radix-ui"` in [components/ui/button.tsx](../../components/ui/button.tsx)),
which is the current shadcn convention.

### shadcn components present (25 files in `components/ui/`)

`alert-dialog`, `avatar`, `badge`, `banner`, `brand-logo`, `button`, `card`,
`confirm-delete-dialog`, `dialog`, `dropdown-menu`, `empty-state`, `file-dropzone`,
`input`, `label`, `person-avatar`, `segmented`, `select`, `separator`, `skeleton`,
`sonner`, `status-chip`, `switch`, `table`, `tabs`, `textarea`, `tooltip`, `toast`(via sonner).

**Notes**
- Several are **bespoke** (not stock shadcn): `banner`, `brand-logo`, `empty-state`,
  `file-dropzone`, `person-avatar`, `segmented`, `status-chip`, `confirm-delete-dialog`.
- **Absent** (specified in the design system but no component file — confirmed in CLAUDE.md
  as "deferred, no call site"): `Checkbox`, `Radio`, `Pagination`, styled `DatePicker`.
  The app uses a custom checklist toggle + `Switch`; nothing paginates; date/file inputs are
  native.

## Animation / 3D / Compiler (the items the brief asked about)

| Capability | Status | Evidence |
|---|---|---|
| `motion` / `framer-motion` | **NOT installed** | absent from `package.json` + `npm ls`. Animation today is CSS-only: `tw-animate-css` + the hand-rolled `.motion-*` utilities and `@keyframes` in `globals.css`. |
| React Three Fiber / `three` / `@react-three/drei` | **NOT installed** | absent. No 3D/WebGL anywhere. |
| React Compiler | **INSTALLED _and ENABLED_** | `babel-plugin-react-compiler@1.0.0` (devDep, also deduped under `next`), and **`reactCompiler: true`** is set in [next.config.ts](../../next.config.ts#L59). So the compiler is already on — Phase-1 work is to _verify_ it, not enable it. |

## Other notable runtime deps (UI-relevant)

| Package | Installed | UI relevance |
|---|---|---|
| `recharts` | **3.8.1** | Charts. **v3 pulls in `@reduxjs/toolkit` + `react-redux`** as transitive deps (it uses Redux internally) — a meaningful bundle cost; already lazy-loaded via `next/dynamic` (see [components/metrics/metrics-charts.tsx](../../components/metrics/metrics-charts.tsx)). |
| `sonner` | 2.0.7 | Toasts (`components/ui/sonner.tsx`). |
| `next-themes` | 0.4.6 | Theme provider present; `@custom-variant dark` defined in CSS. (Dark mode is used for the staff shell + auth, not a user-facing light/dark toggle.) |
| `react-hook-form` + `@hookform/resolvers` + `zod` | 7.78 / 5.4 / 4.4 | Forms + validation. |
| `react-markdown` + `remark-gfm` | 10.1 / 4.0 | Markdown rendering (messages, notes, reports). |
| `class-variance-authority` / `clsx` / `tailwind-merge` | 0.7 / 2.1 / 3.6 | Variant + class composition (`cn()` in `lib/utils`). |
| `playwright` | 1.60.0 | The screenshot/E2E harness (`scripts/*.mjs`). |

## One-line snapshot

> **Next 16.2.9 · React 19.2.4 · Tailwind v4 (4.3.0, CSS-first, no config file) · shadcn 4.11
> on Radix UI (`radix-ui` 1.5.0, style `radix-nova`) · TypeScript 5.9.3 · React Compiler ON.
> No `motion`, no R3F/three.** Charts = recharts 3 (lazy). Animation = CSS-only today.
