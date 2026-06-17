// Clean per-role trace: load ONE page, wait fully (no navigation), capture the exact
// SSL-failing request + every image's final status. Run: node docs/ui-audit/tools/trace-ssl.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const cases = [
  { role: "client", email: "demo-client@example.com", route: "/dashboard" },
  { role: "admin", email: "demo-admin@example.com", route: "/admin/users" },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const { role, email, route } of cases) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const ssl = [];
  const images = [];
  page.on("requestfailed", (req) => {
    const err = req.failure()?.errorText ?? "";
    if (/SSL|CERT/i.test(err)) ssl.push(`${err} :: ${req.resourceType()} :: ${req.url()}`);
  });
  page.on("requestfinished", async (req) => {
    if (req.resourceType() === "image") {
      const res = await req.response();
      images.push(`${res?.status() ?? "?"} :: ${req.url()}`);
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // let images settle, no further nav

  console.log(`\n##### ${role} @ ${route} #####`);
  console.log("SSL/CERT failures:", ssl.length ? ssl : "NONE");
  console.log("image requests:");
  for (const i of [...new Set(images)]) console.log("  ", i);
  await ctx.close();
}
await browser.close();
