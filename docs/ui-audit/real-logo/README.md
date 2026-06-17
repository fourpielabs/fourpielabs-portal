# Real logo rollout

Swap the placeholder text wordmark for the real brand asset everywhere, in the correct
format per context. No auth logic / auth-card layout / 3D backdrop / contrast-scrim
changes; email pipeline kept table-based + raster + fixed-dimension.

## STEP 1 — Inventory (where the logo lived)

| Surface | Source | Before → After |
|---|---|---|
| Client top nav (desktop pill + mobile) | `BrandLogo` (`components/ui/brand-logo.tsx`) | text wordmark → real logo (dark) |
| Staff sidebar (dark rail) + mobile header | `BrandLogo` (`dark` on the rail) | text → real logo (white on rail, dark on mobile) |
| Auth card (login / welcome / reset, desktop + mobile) | `BrandLogo dark` via `components/auth/auth-frame.tsx` | text → real logo (white) |
| Public landing | `BrandLogo` (`app/page.tsx`) | text → real logo (dark) |
| Email — notifications + auth (invite/recovery) | hosted `/email-logo.png` via `renderEmail` (`lib/email-template.ts`, `lib/auth-email-templates.ts`) | **already the real logo** (PNG 150×45, table, inline CSS, alt) |
| Favicon / tab | `app/favicon.ico` | **Next.js default** (25.9 KB) → brand mark |
| App icon / apple-touch / PWA | *did not exist* | added `app/icon.png`, `app/apple-icon.png`, `public/icon-{192,512,maskable-512}.png`, `app/manifest.ts` |
| OG / social image | *did not exist* | out of scope (none existed) |

All UI usages already route through the single `BrandLogo` component, so the swap is one file.

## STEP 2 — The asset(s)

- **`public/logo.webp`** — the real wordmark. WebP, raster, 255×76 (218×61 trimmed), alpha,
  **dark/charcoal** ("4Pie" logotype with a circle-bar "e" mark + lighter-gray "Labs"). Monochrome-ish.
- **`public/email-logo.png`** — same logo as a larger dark PNG (400×120) for email (pre-existing).

**Variants:**
- **Dark treatment** (cream nav, mobile header, landing): the asset as-is. ✓
- **Light treatment** (dark auth card + staff rail): **derived** from the single monochrome asset via
  CSS `filter: brightness(0) invert(1)` → a clean white mark. No second file needed. Verified legible
  on the dark frosted glass.
- **Mark (icon-only):** ⚠️ **FLAG — no dedicated square mark was supplied.** Derived a stopgap from the
  logo's leading **"4" glyph** (the boldest, most legible element at small sizes) — white on a charcoal
  tile. Legible at all icon sizes; **recommend a purpose-drawn mark** for pixel-crisp 16 px favicon work.

## STEP 3 — Replace per context

- **UI:** `BrandLogo` now renders `/logo.webp` with em-based height (scales with each call site's existing
  font-size class → prior optical size preserved), `dark` → white filter. All 7 call sites unchanged.
- **Email:** already on the real `/email-logo.png` (PNG, fixed `width/height`, inline CSS, table layout,
  on the light `#f5f4f1` header) — kept. Re-verified: **12/12 render checks pass** (real logo loads in all
  6 emails — auth invite/recovery + 4 notification types — + amber CTA).
- **Favicon/PWA:** generated via `scripts/gen-icons.mjs` (sharp + an inline PNG-ICO encoder) from the "4"
  mark: `app/favicon.ico` (16/32/48), `app/icon.png`, `app/apple-icon.png` (180), `public/icon-192/512`,
  `public/icon-maskable-512`, and `app/manifest.ts` (theme/bg cream, the 3 PWA icons). Layout gains a
  brand `themeColor`.
- **Manifest defect fixed (called out):** `/manifest.webmanifest` was 307-redirecting (the auth middleware
  matcher excluded `.png/.ico` but not `.webmanifest`, so the public manifest got auth-gated). Added
  `manifest.webmanifest` to the `proxy.ts` matcher exclusion — same class as the existing `favicon.ico` /
  image exclusions; **no auth-logic change** (it just stops running session-refresh on a public asset).

## STEP 4 — Verify

`tsc` clean · `eslint` 0/0 · `next build` green · console clean (no errors) · **every icon/asset resolves
200** (`/favicon.ico`, `/icon.png`, `/apple-icon.png`, `/icon-192|512`, `/icon-maskable-512`,
`/manifest.webmanifest`, `/logo.webp`, `/email-logo.png`) · auth-card layout unchanged + the white logo is
legible on the dark frosted glass.

**Before** (text wordmark): auth `../phase-4-auth/login-live.png`; nav `../first-impression/screens/program-dashboard.png`;
mobile `../first-impression/screens/m-program-dashboard.png`; favicon = Next default.
**After:** `after/auth-desktop.png`, `after/auth-logo-closeup.png`, `after/client-nav-desktop.png`,
`after/staff-sidebar.png`, `after/client-mobile-header.png`; favicon/app icons = the "4" mark
(`app/icon.png`); email previews in `.email-shots/`.
