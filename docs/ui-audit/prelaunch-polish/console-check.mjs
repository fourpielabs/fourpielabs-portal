import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
const BASE = "http://localhost:3100";
const PASS = "FourPie!Demo2026";
const PROGRAM = "71f52a6c-3f89-4c00-bf40-f59746128b16";
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function login(p, e) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill("input[type=email]", e); await p.fill("input[type=password]", PASS);
  await p.click('button:has-text("Sign in")'); await p.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(600);
}
const errs = [];
async function sweep(email, routes) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && errs.push(`[${p.url()}] ${m.text()}`));
  p.on("pageerror", (e) => errs.push(`[${p.url()}] ${e}`));
  await login(p, email);
  for (const r of routes) { await p.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(700); }
  await ctx.close();
}
await sweep("audit-program@example.com", ["/performance", "/messages"]);
await sweep("demo-admin@example.com", [`/clients/${PROGRAM}/competitors`, `/clients/${PROGRAM}/reports`, `/clients/${PROGRAM}/updates`]);
await browser.close();
const real = errs.filter((e) => !/favicon/i.test(e));
console.log("console errors on affected surfaces:", real.length === 0 ? "NONE ✓" : real.slice(0, 6));
