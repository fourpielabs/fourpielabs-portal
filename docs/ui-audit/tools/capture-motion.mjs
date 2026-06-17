// Phase-3 motion verification. Captures (a) the REDUCED-MOTION proof — same surfaces are
// instant / count-ups at final / no transitions — and (b) motion-in-action frame sequences.
// Run (server up): node docs/ui-audit/tools/capture-motion.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const premier = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;
const MOT = "docs/ui-audit/phase-3-motion";
const RED = "docs/ui-audit/phase-3-reduced-motion";
mkdirSync(MOT, { recursive: true });
mkdirSync(RED, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await wait(page, 800);
}

// Count-up + grid stagger fire when the KPI band mounts (after the loading skeleton).
// Wait past the skeleton for the greeting, then sample the count-up window in tight frames.
async function captureDashboardEntrance(page, dir, tag) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "commit" });
  await page.waitForSelector("text=/at a glance/i", { timeout: 20000 }).catch(() => {});
  const deltas = [0, 90, 170, 260];
  let label = 0;
  for (const d of deltas) {
    if (d) await wait(page, d);
    label += d;
    await page.screenshot({ path: `${dir}/${tag}_${label}ms.png` });
  }
}

try {
  // ===== (A) REDUCED MOTION =====
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rp = await rctx.newPage();
  await login(rp, "demo-client@example.com");
  await captureDashboardEntrance(rp, RED, "dashboard"); // every frame should already be FINAL
  // a dialog should appear instantly (no scale/fade) for staff
  await rctx.close();
  const rctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rp2 = await rctx2.newPage();
  await login(rp2, "demo-admin@example.com");
  await rp2.goto(`${BASE}/clients/${premier}/deliverables`, { waitUntil: "networkidle" });
  await wait(rp2, 700);
  await rp2.click('button:has-text("New deliverable"), button:has-text("New")');
  await wait(rp2, 40); // 40ms after open: reduced → already fully shown
  await rp2.screenshot({ path: `${RED}/dialog_40ms.png` });
  await rctx2.close();

  // ===== (B) MOTION IN ACTION =====
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await login(page, "demo-client@example.com");
  await captureDashboardEntrance(page, MOT, "countup-grid"); // numbers counting + cards lifting in

  // card hover (KPI card lifts)
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await wait(page, 900);
  await page.hover('a[href="/performance"] >> nth=0').catch(() => {});
  await wait(page, 220);
  await page.screenshot({ path: `${MOT}/card-hover.png` });

  // button hover/press
  await page.hover('button:has-text("Book a call")').catch(() => {});
  await wait(page, 200);
  await page.screenshot({ path: `${MOT}/button-hover.png` });

  // tab indicator: capture the pill on two sections (before / after nav)
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await wait(page, 600);
  await page.screenshot({ path: `${MOT}/tab-pill_dashboard.png` });
  await page.click('a[href="/deliverables"]');
  await wait(page, 90); // mid/just-after slide
  await page.screenshot({ path: `${MOT}/tab-pill_moving.png` });
  await wait(page, 400);
  await page.screenshot({ path: `${MOT}/tab-pill_deliverables.png` });
  await ctx.close();

  // modal open frames (staff) — scale+fade in
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const p2 = await ctx2.newPage();
  await login(p2, "demo-admin@example.com");
  await p2.goto(`${BASE}/clients/${premier}/deliverables`, { waitUntil: "networkidle" });
  await wait(p2, 700);
  await p2.click('button:has-text("New deliverable"), button:has-text("New")');
  for (const ms of [50, 130, 260]) {
    await wait(p2, ms === 50 ? 50 : 80);
    await p2.screenshot({ path: `${MOT}/modal_${ms}ms.png` });
  }
  // workspace tab underline moving
  await p2.keyboard.press("Escape");
  await p2.goto(`${BASE}/clients/${premier}`, { waitUntil: "networkidle" });
  await wait(p2, 600);
  await p2.screenshot({ path: `${MOT}/ws-tab_overview.png` });
  await p2.click('a:has-text("Metrics")');
  await wait(p2, 90);
  await p2.screenshot({ path: `${MOT}/ws-tab_moving.png` });
  await wait(p2, 400);
  await p2.screenshot({ path: `${MOT}/ws-tab_metrics.png` });
  await ctx2.close();

  console.log("captured →", MOT, "and", RED);
} catch (e) {
  console.log("ERR", String(e?.message ?? e));
} finally {
  await browser.close();
}
