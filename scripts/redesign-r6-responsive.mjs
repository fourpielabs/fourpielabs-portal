// R6 GATE 5 — responsive across 390/768/1024/1440 for the key surfaces, both client types
// + staff + auth. Screens → docs/redesign/r6/responsive/. BASE=... node scripts/redesign-r6-responsive.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const OUT = "docs/redesign/r6/responsive";
mkdirSync(OUT, { recursive: true });
const BP = { 390: "mobile", 768: "tablet", 1024: "sm-desktop", 1440: "desktop" };

async function login(p, email) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(500);
}
let n = 0;
async function cap(p, label, path, widths) {
  for (const w of widths) {
    await p.setViewportSize({ width: w, height: Math.max(740, Math.round(w * 0.7)) });
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(700);
    const f = `${OUT}/${label}-${w}-${BP[w]}.png`;
    await p.screenshot({ path: f, timeout: 60000 });
    n++; console.log("  · " + f.replace(OUT + "/", ""));
  }
}

const ALL = [390, 768, 1024, 1440];
async function main() {
  const b = await chromium.launch({ deviceScaleFactor: 1 });

  // AUTH (no login) — static fallback at mobile + desktop
  {
    const p = await (await b.newContext()).newPage();
    await cap(p, "auth-login", "/login", [390, 1440]);
  }
  // CLIENT PROGRAM — bottom-tab (mobile) + full set
  {
    const p = await (await b.newContext()).newPage(); p.setDefaultNavigationTimeout(60000); await login(p, "demo-client@example.com");
    await cap(p, "client-program-dashboard", "/dashboard", ALL);
    await cap(p, "client-program-deliverables", "/deliverables", [390, 1024]);
    await cap(p, "client-program-performance", "/performance", [390, 1440]);
  }
  // CLIENT PROJECT — projects board
  {
    const p = await (await b.newContext()).newPage(); p.setDefaultNavigationTimeout(60000);
    try { await login(p, "demo-project@example.com"); await cap(p, "client-project-dashboard", "/dashboard", [390, 768, 1440]); await cap(p, "client-project-deliverables", "/deliverables", [390]); }
    catch { console.log("  ⚠ demo-project login failed — skipped"); }
  }
  // STAFF — sidebar/switcher + wide metrics grid + dual-thread messages
  {
    const p = await (await b.newContext()).newPage(); p.setDefaultNavigationTimeout(60000); await login(p, "demo-team@example.com");
    await cap(p, "staff-overview", `/clients/${PREMIER}`, ALL);
    await cap(p, "staff-metrics-wide", `/clients/${PREMIER}/metrics`, [768, 1440]);
    await cap(p, "staff-messages-dualthread", `/clients/${PREMIER}/messages`, [390, 1440]);
  }
  await b.close();
  console.log(`\n=== R6 RESPONSIVE: ${n} captures across 390/768/1024/1440 → ${OUT} ===`);
}
main().catch((e) => { console.error(e); process.exit(1); });
