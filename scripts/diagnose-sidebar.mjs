// Sidebar-height BEFORE/AFTER capture + assertion. Dev-only, NON-DESTRUCTIVE (self-cleans).
//   node scripts/diagnose-sidebar.mjs   (dev server on :3000, FIXED source)
// The fix is a single unlayered rule `.rd-glass.sticky{position:sticky}`. To show the
// regression faithfully we runtime-inject `.rd-glass.sticky{position:relative}` (the exact
// pre-fix computed value) for the BEFORE shots; AFTER shots use the real fixed source.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026", EMAIL = "zz-sb-admin@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/sidebar-height";
mkdirSync(`${OUT}/before`, { recursive: true });
mkdirSync(`${OUT}/after`, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const railM = (page) => page.evaluate(() => {
  const a = document.querySelector("aside"); const r = a.getBoundingClientRect();
  return { pos: getComputedStyle(a).position, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width), vh: innerHeight, covers: r.top <= 1 && r.bottom >= innerHeight - 1, gap: Math.round(innerHeight - r.bottom) };
});
const mid = (page) => page.evaluate(() => scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) / 2)));

async function login(page, dark) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (dark) await page.evaluate(() => localStorage.setItem("rd-mode", "dark"));
  await page.fill("input[type=email]", EMAIL); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await admin.auth.admin.listUsers({ perPage: 1000 }).then(({ data }) => { const u = data?.users.find((x) => x.email === EMAIL); return u && admin.auth.admin.deleteUser(u.id); });
  await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "SB Admin" } });

  for (const [theme, dark, vh] of [["light", false, 820], ["dark", true, 820], ["short", false, 560]]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: vh } });
    const page = await ctx.newPage();
    await login(page, dark);

    // top-of-scroll (looks fine in BOTH states — the point of the diagnosis)
    await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/after/${theme}_audit_top.png` });
    rec(`[${theme}] AFTER  @top  pinned+full-height`, (await railM(page)).covers, JSON.stringify(await railM(page)));

    // mid-scroll AFTER (real fixed source)
    await mid(page); await page.waitForTimeout(400);
    const a = await railM(page);
    await page.screenshot({ path: `${OUT}/after/${theme}_audit_mid.png` });
    rec(`[${theme}] AFTER  @mid  sticky+covers+nogap`, a.pos === "sticky" && a.covers && a.gap === 0, JSON.stringify(a));

    // mid-scroll BEFORE (inject the pre-fix computed value)
    await page.addStyleTag({ content: ".rd-glass.sticky{position:relative}" });
    await mid(page); await page.waitForTimeout(400);
    const b = await railM(page);
    await page.screenshot({ path: `${OUT}/before/${theme}_audit_mid.png` });
    rec(`[${theme}] BEFORE @mid  relative+scrolled-away`, b.pos === "relative" && !b.covers && b.gap > 100, JSON.stringify(b));

    await ctx.close();
  }
} finally {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL); if (u) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
