# design/v2 — provenance & verification

**Fetched:** 2026-06-12 from `https://api.anthropic.com/v1/design/h/j4ck_cIl6KDz5kfNZ5ghSg`
**Tarball sha256:** `09a906e8265d28f7f010e55cde9c9fcaf51adb94cc8e7438d9826a6f921da022`

## ⚠️ Finding: v2 is byte-for-byte identical to v1

Every file in this bundle is **identical** (verified with `cmp` per file) to the
committed v1 package in [`../`](../) (`design/`): README, chat transcript,
`DESIGN_BRIEF.md`, the three ref PNGs, `D1 Style Tile`, `D2 Component Sheet`,
`D4 Handoff Sheet`, and keystones `K1`–`K6`. **16/16 files identical.**

### Consequences for UI-5 remediation
- v2 provides **no new mockup** for any route — including the previously
  keystone-less routes (**staff dashboard, /clients list, /admin/audit**).
- Those routes therefore remain **DERIVED**: assembled strictly from the **D2
  component sheet + D4 handoff + the SITE_STRUCTURE.md target sections** (which
  spell each one out in detail). "Derived" ≠ transitional.
- v2 has **no new content to design-review**, so there are **no new v2-specific
  guardrail violations**. The system already complies with every standing
  guardrail (plain-text emails, no notification UI, no chat/search, amber-700
  under white text, every button → a real server action, v2-wishlist excluded).

This snapshot is retained only for provenance. The authoritative design source is
the v1 `design/` package; SITE_STRUCTURE.md and prior rulings win on any conflict.
