// Confirm zero console errors across authenticated pages, all roles. Captures avatar
// render counts too. Run (server up): node docs/ui-audit/tools/console-sweep.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const plan = {
  admin: { email: "demo-admin@example.com", routes: ["/dashboard", "/clients", "/admin/users", "/admin/audit", "/settings"] },
  team: { email: "demo-team@example.com", routes: ["/dashboard", "/clients", "/settings"] },
  client: { email: "demo-client@example.com", routes: ["/dashboard", "/messages", "/performance", "/deliverables", "/settings", "/documents"] },
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
let avatars = 0, brokenImg = 0;
for (const [role, { email, routes }] of Object.entries(plan)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${role}] ${m.text()}`); });
  page.on("requestfinished", async (req) => {
    if (req.resourceType() === "image") {
      const r = await req.response();
      if (r && r.status() < 400) avatars++;
      else if (r) brokenImg++;
    }
  });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  for (const r of routes) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  await ctx.close();
}
await browser.close();
console.log("CONSOLE ERRORS:", errors.length ? [...new Set(errors)] : "ZERO");
console.log(`images: ${avatars} loaded OK, ${brokenImg} broken`);
