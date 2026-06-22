// BaseModal isolation verify + screenshots. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-base-modal.mjs   (server on :3000)
// The preview route is auth-gated, so we provision a temp admin + log in, then
// screenshot the harness in light / dark / 390w / long-content + assert sizing,
// the single scroll region, no horizontal overflow, and a11y (focus trap, Esc, close).
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const URL = `${BASE}/redesign-preview/base-modal`;
const PASS = "FourPie!Demo2026", EMAIL = "zz-bm-admin@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/base-modal";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const browser = await chromium.launch({ channel: "chrome", headless: true });
const metrics = (page) => page.evaluate(() => {
  const s = document.querySelector(".fui-DialogSurface");
  if (!s) return null;
  const r = s.getBoundingClientRect();
  const scroller = [...s.querySelectorAll("div")].find((d) => getComputedStyle(d).overflowY === "auto");
  return {
    surfaceW: Math.round(r.width), surfaceH: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight,
    pageHoriz: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollerHoriz: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
    canScroll: scroller ? scroller.scrollHeight - scroller.clientHeight : 0,
    hasClose: !!s.querySelector('button[aria-label="Close"]'), focusInDialog: !!s.contains(document.activeElement),
  };
});
async function fresh(w, h, dark = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (dark) await page.evaluate(() => localStorage.setItem("rd-mode", "dark"));
  await page.fill("input[type=email]", EMAIL); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 }); await page.waitForTimeout(700);
  return { ctx, page };
}

try {
  await admin.auth.admin.listUsers({ perPage: 1000 }).then(({ data }) => { const u = data?.users.find((x) => x.email === EMAIL); return u && admin.auth.admin.deleteUser(u.id); });
  await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "BM Admin" } });

  // LIGHT — full check
  let { ctx, page } = await fresh(1280, 900);
  await page.screenshot({ path: `${OUT}/light.png` });
  let m = await metrics(page);
  rec("renders + fits viewport (w<=vw, h<=88vh)", m && m.surfaceW <= m.vw && m.surfaceH <= m.vh * 0.9 + 2, m ? `${m.surfaceW}x${m.surfaceH}/${m.vw}x${m.vh}` : "none");
  rec("no horizontal overflow (page + scroller)", m && m.pageHoriz <= 1 && m.scrollerHoriz <= 1, m ? `page=${m.pageHoriz} scroller=${m.scrollerHoriz}` : "");
  rec("content scrolls INSIDE (single region)", m && m.canScroll > 50, m ? `canScroll=${m.canScroll}` : "");
  rec("labeled close button present", !!m?.hasClose, "");
  // themed dropdown: open the Status list (now a themed Listbox, not the OS popup)
  try {
    await page.locator('.fui-DialogSurface [role="combobox"]').first().click();
    await page.waitForSelector('[role="listbox"] [role="option"]', { timeout: 4000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/dropdown_open.png` });
    const opts = await page.locator('[role="listbox"] [role="option"]').count();
    rec("dropdown opens a THEMED listbox (not OS-native)", opts >= 3, `${opts} options`);
    await page.keyboard.press("Escape");
  } catch (e) { rec("dropdown opens a THEMED listbox (not OS-native)", false, String(e).slice(0, 60)); }
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  rec("focus trap (focus stays in dialog after Tab)", (await metrics(page))?.focusInDialog === true, "");
  await page.locator('.fui-DialogSurface button[aria-label="Close"]').click();
  await page.waitForSelector(".fui-DialogSurface", { state: "detached", timeout: 5000 }).catch(() => {});
  rec("close X closes the modal", (await page.locator(".fui-DialogSurface").count()) === 0, "");
  await ctx.close();

  // Esc closes
  ({ ctx, page } = await fresh(1280, 900));
  await page.keyboard.press("Escape");
  await page.waitForSelector(".fui-DialogSurface", { state: "detached", timeout: 5000 }).catch(() => {});
  rec("Esc closes the modal", (await page.locator(".fui-DialogSurface").count()) === 0, "");
  await ctx.close();

  // DARK
  ({ ctx, page } = await fresh(1280, 900, true));
  await page.screenshot({ path: `${OUT}/dark.png` });
  rec("dark renders", (await page.locator(".fui-DialogSurface").count()) >= 1, "");
  await ctx.close();

  // MOBILE 390
  ({ ctx, page } = await fresh(390, 780));
  await page.screenshot({ path: `${OUT}/mobile_390.png` });
  m = await metrics(page);
  rec("mobile @390: fits + no horizontal overflow", m && m.surfaceW <= 390 && m.pageHoriz <= 1 && m.scrollerHoriz <= 1, m ? `w=${m.surfaceW} page=${m.pageHoriz}` : "");
  await ctx.close();

  // long-content scrolled close-up
  ({ ctx, page } = await fresh(1280, 720));
  await page.evaluate(() => { const s = [...document.querySelectorAll(".fui-DialogSurface div")].find((d) => getComputedStyle(d).overflowY === "auto"); if (s) s.scrollTop = 320; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/long_content_scrolled.png` });
  await ctx.close();
} finally {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL); if (u) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
