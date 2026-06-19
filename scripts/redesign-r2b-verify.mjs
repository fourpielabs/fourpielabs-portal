// R2 Wave 1b verification — Deliverables, Tasks (+detail), Settings.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PROGRAM = "demo-client@example.com";
const PROJECT = "demo-project@example.com";
const OUT = "docs/redesign/r2";
const DSF = 2;
mkdirSync(OUT, { recursive: true });
const msgs = [];
async function login(p, email) {
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") msgs.push(`[${m.type()}] ${m.text().slice(0, 130)}`); });
  p.on("pageerror", (e) => msgs.push(`[pageerror] ${e.message.slice(0, 130)}`));
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(700);
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true, animations: "disabled", timeout: 60000 }).then(() => console.log("  · " + n));
const toggle = (p) => p.locator('button[aria-label*="theme"]:visible').first().click().then(() => p.waitForTimeout(450));
const checks = [];
async function main() {
  const b = await chromium.launch();
  // desktop program: deliverables, tasks, settings
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, PROGRAM);
    for (const [route, name] of [["/deliverables", "deliverables"], ["/tasks", "tasks"], ["/settings", "settings"]]) {
      await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
      await shot(p, `r2-${name}-1440-light`);
      await toggle(p); await shot(p, `r2-${name}-1440-dark`); await toggle(p);
    }
    // invariant: no timer/time-tracking text on tasks board
    await p.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(700);
    const tBody = (await p.locator("main").innerText()).toLowerCase();
    checks.push({ n: "tasks board: no timer/time-tracking", ok: !/start timer|stop timer|time tracked|\btimer\b/.test(tBody) });
    // open first task detail (client) → no status control, no timer, editable title input present
    const firstTask = p.locator('a[href^="/tasks?task="]').first();
    if (await firstTask.count()) {
      await firstTask.click(); await p.waitForTimeout(700);
      const dlg = p.locator('[role="dialog"]');
      const dlgText = (await dlg.innerText().catch(() => "")).toLowerCase();
      const statusSelect = await dlg.locator("select").count();
      const titleInput = await dlg.locator('input[type="text"], input:not([type]), textarea').count();
      checks.push({ n: "task detail (client): no status <select> (status read-only)", ok: statusSelect === 0 });
      checks.push({ n: "task detail (client): no timer/time-tracking", ok: !/start timer|stop timer|time tracked|\btimer\b/.test(dlgText) });
      checks.push({ n: "task detail (client): editable title/desc field present", ok: titleInput > 0 });
      await p.keyboard.press("Escape");
    }
    // settings: Switch present
    await p.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(700);
    const switches = await p.locator('[role="switch"], input[role="switch"], button[role="switch"]').count();
    checks.push({ n: "settings: email-preference Switch present", ok: switches > 0 });
    await ctx.close();
  }
  // mobile program
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, PROGRAM);
    for (const [route, name] of [["/deliverables", "deliverables"], ["/tasks", "tasks"]]) {
      await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
      await shot(p, `r2-${name}-390`);
    }
    await ctx.close();
  }
  // project client deliverables (the seeded one)
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, PROJECT);
    await p.goto(`${BASE}/deliverables`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
    await shot(p, "r2-deliverables-project-1440-light");
    await ctx.close();
  }
  await b.close();
  console.log("\nINVARIANT CHECKS:");
  for (const c of checks) console.log(`  ${c.ok ? "✅" : "❌"} ${c.n}`);
  console.log(`\nconsole: ${msgs.length}; hydration: ${msgs.filter((m) => /hydrat|did not match/i.test(m)).length}`);
  [...new Set(msgs)].slice(0, 8).forEach((m) => console.log("  " + m));
  process.exit(checks.some((c) => !c.ok) ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
