// Verify shell tweaks (staff): top-right bell, theme toggle in user menu (between
// Profile & Sign out), gear icon for client settings; clients UNAFFECTED.
// Dev-only; NON-DESTRUCTIVE (self-cleans). node scripts/verify-shell-tweaks.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/shell-tweaks";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

async function ensureUser(email, meta) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email); if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: meta });
  if (error) throw error; return data.user.id;
}

const ADMIN = "zz-shell-admin@example.com", CLIENTU = "zz-shell-client@example.com", SLUG = "zz-shell";
let clientId;
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard").catch(() => {});
  await page.waitForTimeout(800);
}
try {
  await ensureUser(ADMIN, { role: "admin", full_name: "Shell Admin" });
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ Shell", slug: SLUG, industry: "other_local_service", program: "pipeline", status: "active", client_type: "program" }).select("id").single();
  clientId = cl.id;
  await ensureUser(CLIENTU, { role: "client", client_id: clientId, full_name: "Shell Client" });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // STAFF
  await login(page, ADMIN);
  await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/staff_overview.png` });

  // top-right bell present in the desktop top bar (lg:flex header)
  const bell = await page.locator('header button[aria-label*="otification"], header button:has(svg.lucide-bell)').first().count();
  const bellBox = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("header button")];
    const b = btns.find((x) => /notification|bell/i.test(x.getAttribute("aria-label") || "") || x.querySelector(".lucide-bell"));
    if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x), right: Math.round(window.innerWidth - r.right) };
  });
  rec("staff: bell in a top bar", bell > 0, `count=${bell}`);
  rec("staff: bell is top-right", !!bellBox && bellBox.right < 80, bellBox ? `right-gap=${bellBox.right}px` : "not found");

  // theme toggle NOT in the sidebar header anymore (no moon/sun button in <aside>)
  const sidebarTheme = await page.evaluate(() => {
    const a = document.querySelector("aside");
    return [...a.querySelectorAll("button")].some((b) => b.querySelector(".lucide-moon, .lucide-sun") && !b.closest('[role="menu"]'));
  });
  rec("staff: theme toggle removed from sidebar header", !sidebarTheme, "");

  // gear icon (Settings) for client settings, not the ... (more-horizontal)
  const gear = await page.locator('a[aria-label="Client settings"] svg.lucide-settings').count();
  const moreH = await page.locator('a[aria-label="Client settings"] svg.lucide-more-horizontal').count();
  rec("client-settings button is a GEAR", gear > 0 && moreH === 0, `gear=${gear} more=${moreH}`);

  // open the user menu → theme toggle sits between Profile and Sign out
  await page.locator('aside button[aria-label="Account menu"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/staff_user_menu.png` });
  const menu = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')].map((m) => (m.textContent || "").trim());
    return items;
  });
  const iProfile = menu.findIndex((t) => /Profile/.test(t));
  const iTheme = menu.findIndex((t) => /Dark mode|Light mode/.test(t));
  const iSignout = menu.findIndex((t) => /Sign out/.test(t));
  rec("staff: theme toggle between Profile and Sign out", iProfile >= 0 && iTheme === iProfile + 1 && iSignout === iTheme + 1, `[${menu.join(" | ")}]`);
  await ctx.close();

  // CLIENT — unaffected: no theme toggle in their user menu
  const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const cpage = await cctx.newPage();
  await login(cpage, CLIENTU);
  // client menu opens from the top-right avatar (UserMenu, non-bubble)
  const clientThemeInMenu = await cpage.evaluate(async () => {
    const btn = document.querySelector('button[aria-label="Account menu"]');
    if (!btn) return "no-menu";
    btn.click();
    await new Promise((r) => setTimeout(r, 400));
    const items = [...document.querySelectorAll('[role="menuitem"]')].map((m) => (m.textContent || "").trim());
    return items.some((t) => /Dark mode|Light mode/.test(t)) ? "HAS-THEME" : "no-theme";
  });
  rec("client: theme toggle NOT added to client user menu (staff-only)", clientThemeInMenu !== "HAS-THEME", clientThemeInMenu);
  await cctx.close();
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const e of [ADMIN, CLIENTU]) { const u = list?.users.find((x) => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); }
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
