import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
const BASE = "http://localhost:3100", PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const premier = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;
const b = await chromium.launch({ channel: "chrome", headless: true });
const errs = [];
async function sweep(email, routes) {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await c.newPage();
  p.on("console", (m) => m.type() === "error" && errs.push(`[${p.url()}] ${m.text()}`));
  p.on("pageerror", (e) => errs.push(`[${p.url()}] ${e}`));
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill("input[type=email]", email); await p.fill("input[type=password]", PASS);
  await p.click('button:has-text("Sign in")'); await p.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  for (const r of routes) { await p.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(700); }
  await c.close();
}
await sweep("demo-client@example.com", ["/messages", "/settings"]);
await sweep("demo-admin@example.com", [`/clients/${premier}/messages`, `/clients/${premier}/messages?tab=internal`, `/clients/${premier}/competitors`, `/clients/${premier}/deliverables`, `/clients/${premier}/reports`]);
await b.close();
const real = errs.filter((e) => !/favicon/i.test(e));
console.log("console errors:", real.length === 0 ? "NONE ✓" : real.slice(0, 8));
