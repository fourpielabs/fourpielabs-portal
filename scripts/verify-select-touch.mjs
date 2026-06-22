// Verify the pointer-adaptive Select: desktop (fine) = themed Fluent listbox,
// mobile (coarse/touch) = native <select>. Dev-only, self-cleans the temp admin.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const URL = `${BASE}/redesign-preview/base-modal`;
const PASS = "FourPie!Demo2026", EMAIL = "zz-sel-admin@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/modal-rollout";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", EMAIL); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 }); await page.waitForTimeout(600);
  return page;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await admin.auth.admin.listUsers({ perPage: 1000 }).then(({ data }) => { const u = data?.users.find((x) => x.email === EMAIL); return u && admin.auth.admin.deleteUser(u.id); });
  await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "Sel Admin" } });

  // DESKTOP (fine pointer) — expect Fluent combobox + themed listbox, NO native <select>
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await login(ctx);
    const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    const nativeSelects = await page.locator(".fui-DialogSurface select").count();
    const comboboxes = await page.locator('.fui-DialogSurface [role="combobox"]').count();
    rec("desktop: pointer is FINE", coarse === false, `coarse=${coarse}`);
    rec("desktop: NO native <select> in dialog", nativeSelects === 0, `selects=${nativeSelects}`);
    rec("desktop: Fluent comboboxes present", comboboxes >= 2, `combobox=${comboboxes}`);
    await page.locator('.fui-DialogSurface [role="combobox"]').first().click();
    const opened = await page.waitForSelector('[role="listbox"] [role="option"]', { timeout: 4000 }).then(() => true).catch(() => false);
    rec("desktop: opens THEMED listbox (role=listbox/option)", opened);
    await page.screenshot({ path: `${OUT}/select_desktop_listbox.png` });
    await ctx.close();
  }

  // MOBILE (coarse pointer / touch) — expect native <select>, NO Fluent combobox
  {
    const iPhone = devices["iPhone 13"];
    const ctx = await browser.newContext({ ...iPhone });
    const page = await login(ctx);
    const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    const nativeSelects = await page.locator(".fui-DialogSurface select").count();
    const comboboxes = await page.locator('.fui-DialogSurface [role="combobox"]').count();
    // native option values present + change works through onChange
    const optionVals = await page.evaluate(() => { const s = document.querySelector(".fui-DialogSurface select"); return s ? [...s.options].map((o) => o.value) : []; });
    rec("mobile: pointer is COARSE", coarse === true, `coarse=${coarse}`);
    rec("mobile: native <select> rendered", nativeSelects >= 2, `selects=${nativeSelects}`);
    rec("mobile: NO Fluent combobox", comboboxes === 0, `combobox=${comboboxes}`);
    rec("mobile: native options carried through", optionVals.includes("in_progress") && optionVals.includes("done"), JSON.stringify(optionVals));
    // change the native select → controlled onChange should update it
    const sel = page.locator(".fui-DialogSurface select").first();
    await sel.selectOption("review");
    const after = await sel.inputValue();
    rec("mobile: native select change applies", after === "review", `value=${after}`);
    await page.screenshot({ path: `${OUT}/select_mobile_native.png` });
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
