// Re-shoot the affected surfaces after the pre-launch polish.
//   node docs/ui-audit/prelaunch-polish/capture-polish.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE || "http://localhost:3100";
const PASS = "FourPie!Demo2026";
const PROGRAM = "71f52a6c-3f89-4c00-bf40-f59746128b16";
const DIR = "docs/ui-audit/prelaunch-polish";
mkdirSync(DIR, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);

async function ready() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/login`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server not up");
}
async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await wait(page, 700);
}
async function shot(page, route, name) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
  await wait(page, 1100);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

await ready();
const browser = await chromium.launch({ channel: "chrome", headless: true });

// global-error (static HTML rendered by render-global-error.ts)
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const p = await ctx.newPage();
  await p.goto("file://" + resolve(DIR, "global-error.html"));
  await wait(p, 300);
  await p.screenshot({ path: `${DIR}/global-error.png` });
  await ctx.close();
}

// staff unified empty tabs (admin viewing the empty program client)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await login(p, "demo-admin@example.com");
  await shot(p, `/clients/${PROGRAM}/competitors`, "staff-competitors-after");
  await shot(p, `/clients/${PROGRAM}/reports`, "staff-reports-after");
  await shot(p, `/clients/${PROGRAM}/updates`, "staff-updates-after");
  await ctx.close();
}

// client Performance empty (program client) — new chart + reports copy
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await login(p, "audit-program@example.com");
  await shot(p, "/performance", "client-performance-after");
  await ctx.close();
}

// mobile composer @ 390 (short placeholder on touch)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await login(p, "audit-program@example.com");
  await shot(p, "/messages", "m-messages-after-390");
  await ctx.close();
}

await browser.close();
console.log("captured →", DIR);
