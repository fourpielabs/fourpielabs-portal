// Chat + primitives polish captures. node docs/ui-audit/chat-primitives-polish/capture.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const PASS = "FourPie!Demo2026";
const DIR = "docs/ui-audit/chat-primitives-polish";
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
  await wait(p, 800);
}
await ready();
const b = await chromium.launch({ channel: "chrome", headless: true });
const errs = [];
const track = (p) => { p.on("console", (m) => m.type() === "error" && errs.push(m.text())); p.on("pageerror", (e) => errs.push(String(e))); };

// CLIENT messages — desktop (no header + new left toolbar)
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); track(p);
  await login(p, "demo-client@example.com");
  await p.goto(`${BASE}/messages`, { waitUntil: "networkidle" }); await wait(p, 1200);
  await p.screenshot({ path: `${DIR}/messages-desktop.png` });
  // close-up of the composer (action toolbar + input)
  await p.locator(".border-t.border-border.p-3").last().screenshot({ path: `${DIR}/composer-desktop.png` }).catch(() => {});
  await c.close();
}
// CLIENT messages — mobile 390 (short placeholder + wrapped labeled toolbar)
{
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await c.newPage();
  await login(p, "demo-client@example.com");
  await p.goto(`${BASE}/messages`, { waitUntil: "networkidle" }); await wait(p, 1200);
  await p.screenshot({ path: `${DIR}/messages-mobile.png` });
  await c.close();
}
// The toggle in context — client Settings (email-preference switches)
{
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await c.newPage(); track(p);
  await login(p, "demo-client@example.com");
  await p.goto(`${BASE}/settings`, { waitUntil: "networkidle" }); await wait(p, 1000);
  await p.screenshot({ path: `${DIR}/settings-switches.png` });
  await c.close();
}
// Staff competitor dialog — a Switch + (open) in context
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); track(p);
  await login(p, "demo-admin@example.com");
  const premier = await p.evaluate(async () => null); // not needed; navigate via clients
  await p.goto(`${BASE}/clients`, { waitUntil: "networkidle" }); await wait(p, 600);
  await p.click('text=Premier Painting Co.').catch(() => {});
  await wait(p, 800);
  await p.click('text=Competitors').catch(() => {});
  await wait(p, 800);
  await p.click('button:has-text("Add competitor")').catch(() => {});
  await wait(p, 700);
  await p.screenshot({ path: `${DIR}/competitor-dialog-switch.png` });
  await c.close();
}
await b.close();
console.log("console errors (non-favicon):", errs.filter((e) => !/favicon/i.test(e)).length === 0 ? "NONE ✓" : errs.slice(0, 6));
console.log("captured →", DIR);
