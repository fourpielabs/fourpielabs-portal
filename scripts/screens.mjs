// Dev-only visual verification. Never ships. Usage:
//   node scripts/screens.mjs --role=admin --out=batch1 --routes=/dashboard,/admin/users
// {id} in a route is replaced with the first client's id (staff only).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const PASS = "FourPie!Demo2026";
const EMAIL = {
  admin: "demo-admin@example.com",
  team: "demo-team@example.com",
  client: "demo-client@example.com",
};
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
const BASE = args.base || "http://localhost:3001";
const role = args.role || "admin";
const out = args.out || "shots";
const routes = (args.routes || "/dashboard").split(",");
const viewports = [
  { w: 1440, h: 900, tag: "1440" },
  { w: 390, h: 844, tag: "390" },
];

mkdirSync(`screenshots/${out}`, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${role} ${vp.tag}] ${m.text()}`);
  });

  if (EMAIL[role]) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("input[type=email]", EMAIL[role]);
    await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(700);
  }

  // resolve {id} -> first client (staff)
  let clientId = null;
  if (routes.some((r) => r.includes("{id}"))) {
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" }).catch(() => {});
    const href = await page
      .locator('a[href^="/clients/"]:not([href="/clients/new"])')
      .first()
      .getAttribute("href")
      .catch(() => null);
    clientId = href ? href.split("/")[2] : null;
  }

  for (const rRaw of routes) {
    const r = rRaw.replace("{id}", clientId ?? "_");
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(800);
    const name = r.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
    await page.screenshot({
      path: `screenshots/${out}/${role}_${name}_${vp.tag}.png`,
      fullPage: true,
    });
    console.log(`shot: ${role} ${r} @${vp.tag}`);
  }
  await ctx.close();
}

await browser.close();
if (errors.length) {
  console.log("\nCONSOLE ERRORS:\n" + errors.join("\n"));
} else {
  console.log("\nno console errors");
}
