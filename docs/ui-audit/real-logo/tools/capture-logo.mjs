// Capture the new logo across surfaces (after). node docs/ui-audit/real-logo/tools/capture-logo.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const PASS = "FourPie!Demo2026";
const DIR = "docs/ui-audit/real-logo/after";
mkdirSync(DIR, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);
async function ready() {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/login`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
  throw new Error("server not up");
}
async function login(p, e) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill("input[type=email]", e); await p.fill("input[type=password]", PASS);
  await p.click('button:has-text("Sign in")'); await p.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await wait(p, 900);
}
await ready();
const b = await chromium.launch({ channel: "chrome", headless: true });
const errs = [];
const track = (p) => { p.on("console", (m) => m.type() === "error" && errs.push(m.text())); p.on("pageerror", (e) => errs.push(String(e))); };

// auth card desktop — light logo on the dark frosted card
{ const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); track(p);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await wait(p, 2200);
  await p.screenshot({ path: `${DIR}/auth-desktop.png` });
  // close-up of the desktop logo (top-left of the brand column)
  await p.locator('img[alt="4Pie Labs"]').last().screenshot({ path: `${DIR}/auth-logo-closeup.png` }).catch(() => {});
  await c.close(); }
// auth mobile — light logo on the dark mobile header
{ const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await wait(p, 1500);
  await p.screenshot({ path: `${DIR}/auth-mobile.png` }); await c.close(); }
// client nav desktop — dark logo on the cream pill-nav
{ const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); track(p);
  await login(p, "demo-client@example.com"); await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }); await wait(p, 1200);
  await p.screenshot({ path: `${DIR}/client-nav-desktop.png` }); await c.close(); }
// staff sidebar — light logo on the dark rail
{ const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); track(p);
  await login(p, "demo-admin@example.com"); await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }); await wait(p, 1200);
  await p.screenshot({ path: `${DIR}/staff-sidebar.png` }); await c.close(); }
// client mobile header — dark logo on the light header
{ const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage();
  await login(p, "demo-client@example.com"); await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }); await wait(p, 1200);
  await p.screenshot({ path: `${DIR}/client-mobile-header.png` }); await c.close(); }
await b.close();
console.log("console errors (non-favicon):", errs.filter((e) => !/favicon/i.test(e)).length === 0 ? "NONE ✓" : errs.slice(0, 6));
console.log("captured →", DIR);
