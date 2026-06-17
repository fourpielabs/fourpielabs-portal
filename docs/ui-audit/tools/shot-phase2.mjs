// Phase-2 focused captures: metrics editor (both modes), a date-range picker open,
// and a file-dropzone in a dialog. Run (server up): node docs/ui-audit/tools/shot-phase2.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const premier = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;
const OUT = "docs/ui-audit/phase-2-after/focus";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", "demo-admin@example.com");
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});

  // --- metrics editor: Enter data (default) + Client preview ---
  await page.goto(`${BASE}/clients/${premier}/metrics`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await shot("metrics-enter");
  await page.click('button[role="tab"]:has-text("Client preview")');
  await page.waitForTimeout(1500);
  await shot("metrics-preview");

  // --- report dialog: DateRangePicker + FileDropzone (PDF) ---
  await page.goto(`${BASE}/clients/${premier}/reports`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.click('button:has-text("New report"), button:has-text("New"), button:has-text("Add report")');
  await page.waitForTimeout(700);
  await shot("report-dialog");
  // open the range picker
  await page.click('button:has-text("Period start"), button:has-text("Pick a range")').catch(() => {});
  await page.waitForTimeout(700);
  await shot("report-range-open");

  console.log("captured:", OUT);
} catch (e) {
  console.log("ERR", String(e?.message ?? e));
} finally {
  await ctx.close();
  await browser.close();
}
