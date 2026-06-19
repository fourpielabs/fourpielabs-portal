// R6 GATE 3 — cross-browser (Chrome / Safari=webkit / Firefox). Per engine: Griffel SSR
// (no hydration mismatch), backdrop-filter glass (or solid fallback), Fluent render, the 3D
// gate + static fallback, and a route navigation. BASE=... node scripts/redesign-r6-crossbrowser.mjs
import { chromium, webkit, firefox } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const OUT = "docs/redesign/r6/crossbrowser";
mkdirSync(OUT, { recursive: true });
const HYDRATE = /hydrat|did not match|text content does not match|server.*client|minified react error #41\b|#418|#423/i;

const results = [];
async function run(name, engine) {
  const r = { name, hydration: [], errors: [], glassLogin: null, glassPortal: null, staticHero: null, fluent: null, navOk: null, ok: true, note: "" };
  let b;
  try { b = await engine.launch(); } catch (e) { r.ok = false; r.note = "launch failed: " + e.message; results.push(r); return; }
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") { const t = m.text(); r.errors.push(t); if (HYDRATE.test(t)) r.hydration.push(t); } });
  p.on("pageerror", (e) => { const t = String(e); r.errors.push(t); if (HYDRATE.test(t)) r.hydration.push(t); });
  try {
    // /login — auth glass card + static hero (3D gated off headless)
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 }); await p.waitForTimeout(1000);
    r.glassLogin = await p.evaluate(() => { const g = document.querySelector(".rd-glass"); if (!g) return "no-glass"; const cs = getComputedStyle(g); return (cs.backdropFilter !== "none" ? "blur:" + cs.backdropFilter.slice(0, 14) : "solid-fallback:" + cs.backgroundColor); });
    r.staticHero = (await p.locator("main svg").count()) > 0 ? "static-svg" : ((await p.locator("canvas").count()) > 0 ? "canvas" : "none");
    await p.screenshot({ path: `${OUT}/r6-${name}-login.png` });
    // login → staff dashboard (Griffel SSR + Fluent shell)
    await p.fill('input[type="email"]', "demo-team@example.com"); await p.fill('input[type="password"]', PW);
    await Promise.all([p.waitForURL("**/dashboard", { timeout: 45000 }), p.click('button[type="submit"]')]);
    await p.waitForTimeout(1200);
    // Fluent renders (the shell uses Fluent primitives; check a known Fluent-class element exists)
    r.fluent = (await p.locator('[class*="fui-"]').count()) > 0 ? "rendered" : "missing";
    r.glassPortal = await p.evaluate(() => { const g = document.querySelector(".rd-glass"); if (!g) return "no-glass"; const cs = getComputedStyle(g); return (cs.backdropFilter !== "none" ? "blur" : "solid") + " bg=" + cs.backgroundColor.slice(0, 18); });
    await p.screenshot({ path: `${OUT}/r6-${name}-dashboard.png` });
    // a route navigation (route transition path) into a client workspace
    await p.goto(`${BASE}/clients/${PREMIER}`, { waitUntil: "domcontentloaded", timeout: 45000 }); await p.waitForTimeout(1000);
    r.navOk = (await p.locator("main").innerText().catch(() => "")).length > 50;
    await p.screenshot({ path: `${OUT}/r6-${name}-workspace.png` });
  } catch (e) { r.ok = false; r.note = "flow error: " + e.message.slice(0, 120); }
  await b.close();
  r.ok = r.ok && r.hydration.length === 0 && r.glassLogin && r.glassLogin !== "no-glass" && r.fluent === "rendered" && r.navOk;
  results.push(r);
}

async function main() {
  for (const [n, e] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
    console.log(`\n— ${n} —`);
    await run(n, e);
    const r = results[results.length - 1];
    console.log(`  glass(login): ${r.glassLogin}`);
    console.log(`  static hero: ${r.staticHero}`);
    console.log(`  Fluent: ${r.fluent} · glass(portal): ${r.glassPortal}`);
    console.log(`  nav ok: ${r.navOk}`);
    console.log(`  hydration mismatches: ${r.hydration.length}${r.hydration.length ? " → " + r.hydration[0].slice(0, 80) : ""}`);
    console.log(`  other console errors: ${r.errors.length - r.hydration.length}`);
    if (r.note) console.log(`  note: ${r.note}`);
    console.log(`  ${r.ok ? "✅ PASS" : "❌ ISSUE"}`);
  }
  const allOk = results.every((r) => r.ok);
  console.log(`\n=== R6 CROSS-BROWSER: ${results.filter((r) => r.ok).length}/${results.length} engines clean ===`);
  process.exit(allOk ? 0 : 2);
}
main().catch((e) => { console.error(e); process.exit(1); });
