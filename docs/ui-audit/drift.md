# Design-System Gap (Committed System vs Live Implementation)

## Where the committed system lives
- [design/project/D1 Style Tile.dc.html](../../design/project/D1%20Style%20Tile.dc.html) — palette, type, radius, elevation, focus
- [design/project/D2 Component Sheet.dc.html](../../design/project/D2%20Component%20Sheet.dc.html) — every component + states
- [design/project/D4 Handoff Sheet.dc.html](../../design/project/D4%20Handoff%20Sheet.dc.html) — implementation handoff
- [SITE_STRUCTURE.md](../../SITE_STRUCTURE.md) — IA / shells / density intent

The K1–K6 keystone mockups and the `design/v2` bundle were **removed** (recoverable from git
history; noted in CLAUDE.md). So only the three system docs remain as the visual reference.

## Verdict (read this first)

**The system is strong; the problems are (1) the docs have gone stale, and (2) the system is
applied unevenly because layout/spacing/heading rhythm were never tokenized or turned into
shared primitives.** This is **not** a weak design system — D1/D2/D4 specify a coherent,
tasteful warm-neutral + single-amber system with full component states. The live token layer
(`@theme` in globals.css) is, if anything, _richer_ than the docs. The drift is therefore:

- **Doc → impl value drift:** a handful of token values were tuned post-handoff.
- **Impl → doc growth:** the implementation added tokens, variants, and entire features the
  docs never captured (the docs predate Phase 4/5).
- **Systematization gap:** the parts that _aren't_ tokenized (page width, section rhythm,
  page-header scale, density) are improvised per route → the inconsistency you see.

---

## 1. Token fine-values drifted (low impact, but real)

| Token | D1/D4 intent | Live (`globals.css`) | Note |
|---|---|---|---|
| App bg | `#FAFAF8` | `#f7f6f2` | Live is a warmer/greener cream. |
| `surface-2` | `#F4F4F0` | `#f1f0ea` | Slightly warmer. |
| Elevation tint | `rgba(24,24,27,α)` | `rgba(40,33,24,α)` | Live shadows are **umber-tinted** + use different blur/spread (a deliberate "warmer" retune). |
| Shadow recipe | e1/e2/e3 simple | e1/e2/**e2-hover**/e3 + `--shadow-amber` + `--shadow-inset-top` | Live expanded the elevation set. |

Everything else (ink ramp, borders, full amber ramp, all six semantic palettes, radius sm/md/lg/xl,
focus rings) **matches the docs exactly**. So the palette is faithful; only bg/surface/shadow were retuned.

## 2. The implementation outgrew the docs (docs are STALE)

The biggest "gap" is that **D1/D2/D4 describe an earlier, smaller product.** Added in the
codebase but absent from the design docs:

- **"Premium surface" / color-refresh vars** in `globals.css :root`: `--surface-card` &
  `--surface-raised` (card gradients), `--amber-cta`/`--amber-cta-hover` (the button gradient),
  `--hover-tint`, `--selected-tint`, `--dark-glow-rail` + `--sidebar-dark`, `--spring-tick`,
  `--unsaved-bg`, `--pending-row`. None appear in D1/D4.
- **Amber CTA is now a gradient.** Doc spec: flat `#B45309`, hover `#92400E`. Live
  ([components/ui/button.tsx](../../components/ui/button.tsx#L17)): `bg-amber-700` + the
  `--amber-cta` gradient (`#c2670a → #b45309`) + `--shadow-amber`. Richer than spec — but the
  gradient's **top stop `#c2670a` is lighter than amber-700**, so white text near the top edge
  sits just under the doc's "white only on amber-700+" contrast rule (minor; see findings F-C2).
- **Notification UI exists** (bell + unread badge on staff & client shells). D1/D2 list a hard
  **"DON'T: notification UI anywhere (no bells, badges, unread dots)."** This is not a bug — it's
  Phase 4 scope the docs never caught up with. **The doc rule is obsolete; update it.**
- **Messages/chat, Tasks, @mentions, attachments** — whole surfaces (Phase 4/5) with **no design-doc
  coverage** at all. They were built component-by-component without a spec to drift _from_.

## 3. Component-spec mismatches

| Component | D2 spec | Live | Impact |
|---|---|---|---|
| **"Secondary" button** | white bg + 1px `#D6D3CD` border | live `secondary` = **gray fill** (`bg-surface-2`); the doc's white+border maps to live **`outline`** | **Naming/semantic mismatch.** Call sites that want a quiet-but-real action pick `secondary` and get a muted gray that reads as **disabled** — see the Settings "Save changes"/"Save preferences" buttons (findings F-CC1). |
| Button variant set | primary, accent, secondary, ghost, destructive, icon | default, **amber** (≈accent), outline, secondary, ghost, destructive, **link** | Mostly a superset; `accent`→`amber` rename + added `outline`/`link`. Fine, but undocumented. |
| Radius pill | `--radius-pill: 999px` token | no token; `rounded-full` inline | Cosmetic; works. |
| Checkbox / Radio / Pagination / styled DatePicker | fully specced in D2 | **not implemented** (custom checklist toggle + `Switch`; native date/file inputs) | Intentional (CLAUDE.md: "deferred, no call site"). Native `<input type=date>` is the visible cost. |
| Spacing scale | 4px base + **density rule** (client 24–28 / staff 20–22, section 24–32 / 20) | **no spacing tokens**; Tailwind defaults applied ad-hoc | **The core systematization gap.** Density is per-component guesswork → uneven rhythm across routes. |

## 4. Layout / structure drift (highest leverage)

- **No shared page-shell primitive.** The shells exist
  ([components/shell/client-shell.tsx](../../components/shell/client-shell.tsx),
  [staff-shell.tsx](../../components/shell/staff-shell.tsx)) and are good, but **inside** the
  shell every page hand-rolls its own `max-w-*`, heading size, and vertical rhythm. There is no
  `<PageHeader>` / `<PageContainer>` component. Result:
  - Client content width drifts (`max-w-[1280px]` shell vs narrower one-off columns on Settings).
  - **Page-header scale is inconsistent**: the client Dashboard uses the big Bricolage
    `display-xl` greeting, but Settings uses a small centered "Your profile", and Deliverables a
    medium "Deliverables". Same role, three different header treatments.
  - List/board pages (client Deliverables, the project board) **stretch edge-to-edge** with large
    empty mid-row gaps on 1440 because nothing constrains/【grids】 them.
- **Density rhythm intent is real but unenforced.** D4's "spacious client / compact staff" is
  honored on hero surfaces (client Dashboard, login) but inverted elsewhere — the staff Metrics
  editor is _over-dense/cluttered_ while client Settings/Deliverables are _over-sparse_.

> **✅ RESOLVED — Phase 1, batch 1.** The missing page-shell primitive and unsystematized
> spacing/density are now fixed: `<PageContainer>` + `<PageHeader>` own width/centering/padding/
> density, driven by new `@theme` spacing/density tokens, adopted on every route. The shells
> released their hardcoded `max-w`/padding to the primitive. Heroes are preserved as intentional
> exceptions. See [layout-spec.md](./layout-spec.md). (Findings #1/#2/#4.)

## Bottom line for Phase 1
1. **Refresh the design docs** to match shipped reality (Messages, Tasks, Notifications, the
   gradient CTA, the premium-surface tokens) — or the next builder will "fix" drift that's
   actually intended.
2. **Tokenize spacing + add `<PageHeader>`/`<PageContainer>` primitives** so the (good) system is
   applied identically on every route. This single change removes most of the "unpolished" feel
   (see [findings.md](./findings.md)).
3. **Reconcile the button variants** (rename/realign `secondary` vs `outline`; stop using the
   muted variant for primary actions).
