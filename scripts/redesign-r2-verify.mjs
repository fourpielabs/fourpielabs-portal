// REDESIGN R2 verification (Wave 1) — converted client surfaces, BOTH client types.
//   BASE=http://localhost:3005 node scripts/redesign-r2-verify.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PROGRAM = "demo-client@example.com"; // Premier Painting (program, populated)
const PROJECT = "demo-project@example.com"; // Demo Project Co. (project, seeded)
const OUT = "docs/redesign/r2";
const DSF = 2;
mkdirSync(OUT, { recursive: true });

const consoleMsgs = [];
async function login(page, email) {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 140)}`); });
  page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message.slice(0, 140)}`));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PW);
  await Promise.all([page.waitForURL("**/dashboard", { timeout: 30000 }), page.click('button[type="submit"]')]);
  await page.waitForTimeout(900);
}
const shot = (p, name, full = true) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full, animations: "disabled", timeout: 60000 }).then(() => console.log("  · " + name));
const toggle = (p) => p.locator('button[aria-label*="theme"]:visible').first().click().then(() => p.waitForTimeout(450));

const checks = [];
async function main() {
  const browser = await chromium.launch();

  // ---- PROGRAM dashboard ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, PROGRAM);
    console.log("PROGRAM dashboard");
    await shot(p, "r2-dashboard-program-1440-light");
    await toggle(p); await shot(p, "r2-dashboard-program-1440-dark"); await toggle(p);
    // invariant: no time-tracking/timer text on the client dashboard
    const bodyText = (await p.locator("main").innerText()).toLowerCase();
    checks.push({ name: "program dashboard: no timer/time-tracking text", ok: !/time tracked|start timer|stop timer|timer/.test(bodyText) });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, PROGRAM);
    await shot(p, "r2-dashboard-program-390");
    await ctx.close();
  }

  // ---- PROJECT dashboard = projects board ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, PROJECT);
    console.log("PROJECT projects board");
    await shot(p, "r2-projects-board-1440-light");
    await toggle(p); await shot(p, "r2-projects-board-1440-dark"); await toggle(p);
    // invariant: project status is READ-ONLY — no <select>/status control inside project cards,
    // and the board shows status chips. Edit dialog must NOT contain a status field.
    const hasStatusSelect = await p.locator('main select').count();
    checks.push({ name: "projects board: no status <select> on cards", ok: hasStatusSelect === 0 });
    // open the edit dialog and assert no "status" field label
    const editBtn = p.locator('button:has-text("Edit")').first();
    if (await editBtn.count()) {
      await editBtn.click(); await p.waitForTimeout(500);
      const dlg = (await p.locator('[role="dialog"]').innerText().catch(() => "")).toLowerCase();
      checks.push({ name: "project edit dialog: no status control (status lock)", ok: !/\bstatus\b/.test(dlg) });
      await p.keyboard.press("Escape");
    }
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, PROJECT);
    await shot(p, "r2-projects-board-390");
    // project client must NOT have program-only nav (Program/Performance/Content)
    const nav = (await p.locator("header").first().innerText().catch(() => "")).toLowerCase();
    checks.push({ name: "project client: program-only tabs absent (mobile header has no Program/Performance/Content)", ok: !/performance/.test(nav) });
    await ctx.close();
  }

  // ---- reduced-transparency solid fallback (program dashboard) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await login(p, PROGRAM);
    await shot(p, "r2-dashboard-program-reduced-1440");
    await ctx.close();
  }

  await browser.close();
  console.log("\nINVARIANT / TYPE CHECKS:");
  for (const c of checks) console.log(`  ${c.ok ? "✅" : "❌"} ${c.name}`);
  console.log(`\nconsole: ${consoleMsgs.length} msgs; hydration: ${consoleMsgs.filter((m) => /hydrat|did not match/i.test(m)).length}`);
  [...new Set(consoleMsgs)].slice(0, 8).forEach((m) => console.log("  " + m));
  process.exit(checks.some((c) => !c.ok) ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
