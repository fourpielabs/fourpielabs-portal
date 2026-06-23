// S1 owner-review screenshots: dark-mode editor, mobile editor, staff internal composer
// (the "Internal — the client cannot see this" boundary banner). Self-cleans temp users.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-shot-admin@example.com", CLIENT = "zz-shot-client@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/messages/s1"; mkdirSync(OUT, { recursive: true });
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
const dark = (page) => page.addInitScript(() => localStorage.setItem("rd-mode", "dark"));
let clientId = null;
try {
  await delU(ADMIN); await delU(CLIENT);
  await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "Shot Admin" } });
  const { data: c } = await admin.from("clients").select("id").eq("client_type", "project").limit(1).single(); clientId = c.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "Shot Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "Shot Client" }).eq("id", cu.user.id);

  const login = async (page, email) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  };

  // 1) DARK desktop, client /messages
  let ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); let page = await ctx.newPage(); await dark(page);
  await login(page, CLIENT);
  await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-richeditor", { timeout: 20000 }); await page.waitForTimeout(700);
  await page.locator(".rd-richeditor").click(); await page.keyboard.type("Dark-mode WYSIWYG check");
  await page.locator('button[aria-label="Bold"]').click(); await page.keyboard.type(" bold");
  await page.screenshot({ path: `${OUT}/dark_editor.png`, fullPage: true });
  await ctx.close();

  // 2) MOBILE (390px), client /messages, light
  ctx = await b.newContext({ viewport: { width: 390, height: 850 } }); page = await ctx.newPage();
  await login(page, CLIENT);
  await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-richeditor", { timeout: 20000 }); await page.waitForTimeout(700);
  await page.locator(".rd-richeditor").click(); await page.keyboard.type("Mobile composer");
  await page.screenshot({ path: `${OUT}/mobile_editor.png`, fullPage: true });
  await ctx.close();

  // 3) STAFF internal thread — the boundary banner + amber composer
  ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); page = await ctx.newPage();
  await login(page, ADMIN);
  await page.goto(`${BASE}/clients/${clientId}/messages?tab=internal`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-richeditor", { timeout: 20000 }); await page.waitForTimeout(700);
  await page.locator(".rd-richeditor").click(); await page.keyboard.type("Internal note — clients never see this");
  await page.screenshot({ path: `${OUT}/staff_internal_composer.png`, fullPage: true });
  await ctx.close();

  console.log("✓ screenshots: dark_editor.png, mobile_editor.png, staff_internal_composer.png");
} finally {
  await admin.from("messages").delete().eq("client_id", clientId).ilike("body", "%Internal note%");
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
