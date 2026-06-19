// R3 COMPLETION verification — re-prove the cross-cutting invariants AFTER the full
// staff + admin conversion: internal-thread boundary, timer presence/absence, admin
// guards, role visibility, and the reduced-motion fallback smoke.
// BASE=http://localhost:3005 node scripts/redesign-r3-complete-verify.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const ADMIN = "demo-admin@example.com", TEAM = "demo-team@example.com", CLIENT = "demo-client@example.com";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const PREMIER_TASK = "154e8f14-1616-498d-b442-736893d727e4";
const OUT = "docs/redesign/r3";
mkdirSync(OUT, { recursive: true });

const checks = [];
const ck = (n, ok, extra = "") => { checks.push({ n, ok, extra }); console.log(`  ${ok ? "✅" : "❌"} ${n}${extra ? " — " + extra : ""}`); };
async function login(p, email) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(600);
}
const path = (p) => new URL(p.url()).pathname;

async function main() {
  const b = await chromium.launch();

  console.log("\n— INTERNAL-THREAD BOUNDARY —");
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000);
    // staff: internal indicator present
    await login(p, TEAM);
    await p.goto(`${BASE}/clients/${PREMIER}/messages?tab=internal`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900);
    const sTxt = (await p.locator("main").innerText().catch(() => "")).toLowerCase();
    ck("staff internal thread shows the 'client cannot see this' guardrail", /the client cannot see this|staff-only/.test(sTxt));
    await ctx.close();
    // client: cannot reach the staff/internal route; own /messages has no internal surface
    const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p2 = await ctx2.newPage(); p2.setDefaultNavigationTimeout(60000); await login(p2, CLIENT);
    await p2.goto(`${BASE}/clients/${PREMIER}/messages?tab=internal`, { waitUntil: "domcontentloaded" });
    await p2.waitForURL("**/dashboard", { timeout: 6000 }).catch(() => {});
    ck("client redirected away from the staff/internal messages route", path(p2) === "/dashboard", `landed ${path(p2)}`);
    await p2.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" }); await p2.waitForTimeout(900);
    const cTxt = (await p2.locator("main").innerText().catch(() => "")).toLowerCase();
    ck("client /messages exposes NO internal surface", !/internal/.test(cTxt) && !/the client cannot see this/.test(cTxt));
    await ctx2.close();
  }

  console.log("\n— TIMER (staff-only) —");
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); await login(p, TEAM);
    await p.goto(`${BASE}/clients/${PREMIER}/tasks?task=${PREMIER_TASK}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1100);
    const dlg = p.locator('[role="dialog"]');
    const dTxt = (await dlg.innerText().catch(() => "")).toLowerCase();
    ck("staff task detail HAS the timer (Time tracking) + a status control", /time tracking/.test(dTxt) && (await dlg.locator("select").count()) > 0);
    await ctx.close();
    const ctx2 = await b.newContext({ viewport: { width: 1280, height: 1000 } });
    const p2 = await ctx2.newPage(); p2.setDefaultNavigationTimeout(60000); await login(p2, CLIENT);
    await p2.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" }); await p2.waitForTimeout(800);
    const first = p2.locator('a[href^="/tasks?task="]').first();
    if (await first.count()) {
      await first.click(); await p2.waitForTimeout(900);
      const cd = (await p2.locator('[role="dialog"]').innerText().catch(() => "")).toLowerCase();
      ck("client task detail has NO timer + NO status control", !/time tracking|start timer/.test(cd) && (await p2.locator('[role="dialog"] select').count()) === 0);
    } else ck("client task detail has NO timer (no visible tasks → vacuously true)", true);
    await ctx2.close();
  }

  console.log("\n— ADMIN GUARDS + ROLE VISIBILITY —");
  {
    // admin: sidebar has Users + Audit
    const ctxA = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const pA = await ctxA.newPage(); pA.setDefaultNavigationTimeout(60000); await login(pA, ADMIN);
    const aNav = (await pA.locator("aside").first().innerText().catch(() => "")).toLowerCase();
    ck("admin sidebar shows Users + Audit", /users/.test(aNav) && /audit/.test(aNav));
    await ctxA.close();
    // team: sidebar has Clients but NOT Users/Audit; blocked from /admin
    const ctxT = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const pT = await ctxT.newPage(); pT.setDefaultNavigationTimeout(60000); await login(pT, TEAM);
    const tNav = (await pT.locator("aside").first().innerText().catch(() => "")).toLowerCase();
    ck("team sidebar shows Clients but NOT Users/Audit", /client/.test(tNav) && !/\busers\b/.test(tNav) && !/\baudit\b/.test(tNav));
    await pT.goto(`${BASE}/admin/audit`, { waitUntil: "domcontentloaded" });
    await pT.waitForURL((u) => !u.pathname.startsWith("/admin"), { timeout: 6000 }).catch(() => {});
    ck("team blocked from /admin/audit", !path(pT).startsWith("/admin"), `landed ${path(pT)}`);
    await ctxT.close();
    // client: nav has NO staff chrome (Clients/Admin/Users); blocked from /clients
    const ctxC = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const pC = await ctxC.newPage(); pC.setDefaultNavigationTimeout(60000); await login(pC, CLIENT);
    // precise: the client shell must expose NO staff/admin nav LINKS (body copy may contain
    // words like "Discovery & Audit" — a program milestone — so test hrefs, not text).
    const staffLinks = await pC.locator('a[href="/clients"], a[href^="/admin"]').count();
    ck("client shell shows NO staff chrome (0 staff/admin nav links)", staffLinks === 0, `staff links=${staffLinks}`);
    await pC.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
    await pC.waitForURL("**/dashboard", { timeout: 6000 }).catch(() => {});
    ck("client blocked from /clients", path(pC) === "/dashboard", `landed ${path(pC)}`);
    await ctxC.close();
  }

  console.log("\n— REDUCED-MOTION FALLBACK SMOKE —");
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 2 });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); await login(p, TEAM);
    await p.goto(`${BASE}/clients/${PREMIER}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1000);
    const txt = (await p.locator("main").innerText().catch(() => "")).toLowerCase();
    ck("reduced-motion: staff workspace still renders (chrome + overview)", /premier painting|recent activity|checklist/.test(txt));
    await p.screenshot({ path: `${OUT}/r3-reduced-motion-overview.png`, animations: "disabled" });
    console.log("  · r3-reduced-motion-overview.png");
    await ctx.close();
  }

  await b.close();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n=== R3 COMPLETION: ${checks.length - failed.length}/${checks.length} passed ===`);
  process.exit(failed.length ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
