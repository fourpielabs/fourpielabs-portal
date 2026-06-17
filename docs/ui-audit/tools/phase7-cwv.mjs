// Supplements the Lighthouse /login run with in-app Core Web Vitals on AUTHENTICATED
// routes (which Lighthouse can't reach without a session). Measures LCP, CLS, and a
// TBT proxy (long-tasks) via PerformanceObservers. Unthrottled local — directional, not
// a substitute for field data.  node docs/ui-audit/tools/phase7-cwv.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE || "http://localhost:3100";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const premier = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;

const OBSERVE = () => {
  window.__cwv = { lcp: 0, cls: 0, tbt: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__cwv.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cwv.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__cwv.tbt += Math.max(0, e.duration - 50);
  }).observe({ type: "longtask", buffered: true });
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
}

async function measure(email, route, label) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await login(page, email);
  await ctx.addInitScript(OBSERVE);
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const v = await page.evaluate(() => window.__cwv);
  await ctx.close();
  console.log(
    `${label.padEnd(28)} LCP ${(v.lcp / 1000).toFixed(2)}s   CLS ${v.cls.toFixed(3)}   TBT ${Math.round(v.tbt)}ms`,
  );
}

console.log("=== In-app CWV (local, UNTHROTTLED — directional) ===");
await measure("demo-client@example.com", "/dashboard", "client /dashboard");
await measure("demo-client@example.com", "/performance", "client /performance (chart)");
await measure("demo-admin@example.com", `/clients/${premier}/metrics`, "staff /metrics (wide+chart)");
await measure("demo-admin@example.com", `/clients/${premier}/messages`, "staff /messages");
await browser.close();
