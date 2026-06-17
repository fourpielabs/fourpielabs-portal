import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
const BASE = "http://localhost:3100", PASS = "FourPie!Demo2026", DIR = "docs/ui-audit/chat-primitives-polish";
const b = await chromium.launch({ channel: "chrome", headless: true });
const c = await b.newContext({ viewport: { width: 1100, height: 1000 } });
const p = await c.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await p.fill("input[type=email]", "demo-client@example.com");
await p.fill("input[type=password]", PASS);
await p.click('button:has-text("Sign in")');
await p.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(700);
await p.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const n = await p.locator('[data-slot="switch"]').count();
console.log("switches on /settings:", n);
if (n > 0) {
  await p.locator('[data-slot="switch"]').first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${DIR}/settings-switches.png` });
}
await b.close();
console.log("done");
