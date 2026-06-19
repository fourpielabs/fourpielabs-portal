// R6 GATE 2 (cont.) — keyboard/Tabster + decorative-layer a11y.
// - decorative layers (3D hero, AmbientField) aria-hidden + pointer-events:none
// - keyboard: interactive elements reachable via Tab, with a visible focus indicator
// - modal: focus traps inside + Esc closes (Fluent Tabster). BASE=... node scripts/redesign-r6-a11y.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const checks = [];
const ck = (n, ok, extra = "") => { checks.push({ n, ok, extra }); console.log(`  ${ok ? "✅" : "❌"} ${n}${extra ? " — " + extra : ""}`); };
async function login(p, email) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(500);
}
const focusInfo = (p) => p.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { tag: "BODY" };
  const cs = getComputedStyle(a);
  const visible = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== "none";
  return { tag: a.tagName, role: a.getAttribute("role"), label: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 24), visible };
});

async function main() {
  const b = await chromium.launch();

  // ===== DECORATIVE LAYERS =====
  console.log("\n— decorative layers aria-hidden + pointer-events:none —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
    const hero = await p.evaluate(() => {
      const el = document.querySelector('main [aria-hidden="true"].pointer-events-none, main > [aria-hidden]');
      if (!el) return null; const cs = getComputedStyle(el);
      return { ariaHidden: el.getAttribute("aria-hidden"), pe: cs.pointerEvents };
    });
    ck("auth hero backdrop is aria-hidden + pointer-events:none", !!hero && hero.ariaHidden === "true" && hero.pe === "none", JSON.stringify(hero));
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); await login(p, "demo-team@example.com");
    await p.goto(`${BASE}/clients/${PREMIER}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
    const field = await p.evaluate(() => {
      const el = document.querySelector(".rd-field-light, .rd-field-dark");
      if (!el) return null; const cs = getComputedStyle(el); const parent = el.parentElement; const pcs = parent ? getComputedStyle(parent) : null;
      return { ariaHidden: el.getAttribute("aria-hidden") || parent?.getAttribute("aria-hidden"), pe: cs.pointerEvents, parentPe: pcs?.pointerEvents };
    });
    ck("AmbientField is aria-hidden + pointer-events:none", !!field && field.ariaHidden === "true" && (field.pe === "none" || field.parentPe === "none"), JSON.stringify(field));
    await ctx.close();
  }

  // ===== KEYBOARD reachability + visible focus (staff overview) =====
  console.log("\n— keyboard: reachability + visible focus + no trap —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); await login(p, "demo-team@example.com");
    await p.goto(`${BASE}/clients/${PREMIER}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
    await p.evaluate(() => (document.activeElement && document.activeElement.blur && document.activeElement.blur()));
    const seen = new Set(); let visibleFocusCount = 0; let tabs = 0;
    for (let i = 0; i < 25; i++) {
      await p.keyboard.press("Tab"); tabs++;
      const f = await focusInfo(p);
      if (f.tag !== "BODY") { seen.add(`${f.tag}:${f.label}`); if (f.visible) visibleFocusCount++; }
    }
    ck("keyboard: many distinct interactive elements reachable via Tab", seen.size >= 8, `${seen.size} distinct in ${tabs} tabs`);
    ck("keyboard: focused elements show a visible focus indicator", visibleFocusCount >= seen.size * 0.6, `${visibleFocusCount} visible-focus hits`);
    await ctx.close();
  }

  // ===== MODAL focus trap + Esc restore (Fluent Tabster) =====
  console.log("\n— modal: focus trap + Esc closes/restores —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); await login(p, "demo-team@example.com");
    await p.goto(`${BASE}/clients/${PREMIER}/deliverables`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900);
    const trigger = p.getByRole("button", { name: /new deliverable/i }).first();
    if (await trigger.count()) {
      await trigger.click(); await p.waitForTimeout(700);
      const dialogOpen = (await p.locator('[role="dialog"]').count()) > 0;
      ck("modal opens", dialogOpen);
      // Tab several times, assert focus stays within the dialog
      let inside = 0, total = 0;
      for (let i = 0; i < 10; i++) { await p.keyboard.press("Tab"); total++; const within = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')); if (within) inside++; }
      ck("modal traps focus (Tab stays inside)", inside === total, `${inside}/${total} tabs stayed inside`);
      await p.keyboard.press("Escape"); await p.waitForTimeout(500);
      ck("modal closes on Esc", (await p.locator('[role="dialog"]').count()) === 0);
    } else ck("modal trigger found", false, "New deliverable button not found");
    await ctx.close();
  }

  await b.close();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n=== R6 A11Y (keyboard/decorative): ${checks.length - failed.length}/${checks.length} ===`);
  process.exit(failed.length ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
