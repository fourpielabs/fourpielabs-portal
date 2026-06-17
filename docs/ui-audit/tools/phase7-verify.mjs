// Phase-7 hardening verification:
//  A) keyboard a11y proof — the two mobile modals trap focus + Escape-close + restore
//  B) console-clean across roles (admin + client) on key routes
//  C) responsive screenshots @ 390/768/1024/1440
//  D) cross-browser (chromium / firefox / webkit) — render + console + backdrop-filter support
//   node docs/ui-audit/tools/phase7-verify.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium, firefox, webkit } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const PASS = "FourPie!Demo2026";
const RESP = "docs/ui-audit/phase-7-responsive";
const XB = "docs/ui-audit/phase-7-crossbrowser";
mkdirSync(RESP, { recursive: true });
mkdirSync(XB, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const premier = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;

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

await ready();
const results = [];

// ===================== A) KEYBOARD A11Y PROOF =====================
{
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  // CLIENT "More" sheet
  await login(page, "demo-client@example.com");
  await page.click('button[aria-label="More"]');
  await wait(page, 250);
  const moreIn = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="More menu"]');
    return !!d && d.contains(document.activeElement);
  });
  // Tab 6x — focus must stay within the dialog
  let moreTrapped = true;
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-label="More menu"]');
      return !!d && d.contains(document.activeElement);
    });
    if (!inside) moreTrapped = false;
  }
  await page.keyboard.press("Escape");
  await wait(page, 250);
  const moreClosedRestored = await page.evaluate(() => {
    const gone = !document.querySelector('[role="dialog"][aria-label="More menu"]');
    const onTrigger = document.activeElement?.getAttribute("aria-label") === "More";
    return gone && onTrigger;
  });
  results.push(["A.client More sheet: focus-in", moreIn]);
  results.push(["A.client More sheet: Tab trapped", moreTrapped]);
  results.push(["A.client More sheet: Escape closes + restores focus", moreClosedRestored]);
  await ctx.close();

  // STAFF drawer
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage();
  await login(p2, "demo-admin@example.com");
  await p2.click('button[aria-label="Open menu"]');
  await wait(p2, 250);
  const drawIn = await p2.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation menu"]');
    return !!d && d.contains(document.activeElement);
  });
  let drawTrapped = true;
  for (let i = 0; i < 6; i++) {
    await p2.keyboard.press("Tab");
    const inside = await p2.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation menu"]');
      return !!d && d.contains(document.activeElement);
    });
    if (!inside) drawTrapped = false;
  }
  await p2.keyboard.press("Escape");
  await wait(p2, 250);
  const drawClosedRestored = await p2.evaluate(() => {
    const gone = !document.querySelector('[role="dialog"][aria-label="Navigation menu"]');
    const onTrigger = document.activeElement?.getAttribute("aria-label") === "Open menu";
    return gone && onTrigger;
  });
  results.push(["A.staff drawer: focus-in", drawIn]);
  results.push(["A.staff drawer: Tab trapped", drawTrapped]);
  results.push(["A.staff drawer: Escape closes + restores focus", drawClosedRestored]);
  await ctx2.close();
  await browser.close();
}

// ===================== B) CONSOLE-CLEAN ACROSS ROLES =====================
async function consoleSweep(label, email, routes) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(`[${page.url()}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${page.url()}] ${String(e)}`));
  await login(page, email);
  for (const r of routes) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => {});
    await wait(page, 600);
  }
  await browser.close();
  // ignore well-known noise: favicon 404s
  const real = errors.filter((e) => !/favicon/i.test(e));
  results.push([`B.console ${label} (${real.length} errors)`, real.length === 0, real.slice(0, 5)]);
  return real;
}
await consoleSweep("admin", "demo-admin@example.com", [
  "/dashboard", "/clients", `/clients/${premier}`, `/clients/${premier}/metrics`,
  `/clients/${premier}/messages`, `/clients/${premier}/tasks`, "/admin/users",
]);
await consoleSweep("client", "demo-client@example.com", [
  "/dashboard", "/messages", "/performance", "/tasks", "/deliverables", "/documents", "/calls-notes",
]);

// ===================== C) RESPONSIVE SCREENSHOTS =====================
{
  const widths = [390, 768, 1024, 1440];
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  // client dashboard
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
    const page = await ctx.newPage();
    await login(page, "demo-client@example.com");
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await wait(page, 1200);
    await page.screenshot({ path: `${RESP}/client-dashboard-${w}.png` });
    await ctx.close();
  }
  // staff metrics workspace (the wide entry tab)
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await login(page, "demo-admin@example.com");
    await page.goto(`${BASE}/clients/${premier}/metrics`, { waitUntil: "networkidle" });
    await wait(page, 1200);
    await page.screenshot({ path: `${RESP}/staff-metrics-${w}.png` });
    await ctx.close();
  }
  // login (auth static fallback on mobile)
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await wait(page, 1000);
    await page.screenshot({ path: `${RESP}/login-${w}.png` });
    await ctx.close();
  }
  await browser.close();
  results.push(["C.responsive screenshots (390/768/1024/1440 × dashboard/metrics/login)", true]);
}

// ===================== D) CROSS-BROWSER =====================
for (const [name, engine, opts] of [
  ["chromium", chromium, { channel: "chrome" }],
  ["firefox", firefox, {}],
  ["webkit", webkit, {}],
]) {
  try {
    const browser = await engine.launch({ headless: true, ...opts });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    // login page — auth card / backdrop-filter / static hero
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await wait(page, 1200);
    const bf = await page.evaluate(() =>
      CSS.supports("backdrop-filter", "blur(4px)") || CSS.supports("-webkit-backdrop-filter", "blur(4px)"));
    const hasCanvas = await page.$("canvas");
    await page.screenshot({ path: `${XB}/login-${name}.png` });
    // an authenticated route + a chart route
    await login(page, "demo-admin@example.com");
    await page.goto(`${BASE}/clients/${premier}/metrics`, { waitUntil: "networkidle" });
    await wait(page, 1500);
    await page.screenshot({ path: `${XB}/metrics-${name}.png` });
    await browser.close();
    const real = errors.filter((e) => !/favicon/i.test(e));
    results.push([`D.${name}: backdrop-filter=${bf} canvas=${!!hasCanvas} console=${real.length}`, real.length === 0, real.slice(0, 4)]);
  } catch (e) {
    results.push([`D.${name}: LAUNCH FAILED`, false, [String(e.message || e)]]);
  }
}

// ===================== REPORT =====================
console.log("\n================ PHASE 7 VERIFY ================");
let pass = 0, fail = 0;
for (const [label, ok, extra] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (extra && extra.length) extra.forEach((x) => console.log("        · " + x));
  ok ? pass++ : fail++;
}
console.log(`\n${pass} pass, ${fail} fail`);
