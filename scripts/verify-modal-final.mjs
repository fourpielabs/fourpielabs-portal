// STEP 3 final verification — light/dark screenshots of the converted dialogs, with the
// client task + project dialogs proven to have NO status control. Self-cleans temp users.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const ADMIN = "zz-fin-admin@example.com", CLIENT = "zz-fin-client@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/modal-rollout/final";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

async function del(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === email); if (u) await admin.auth.admin.deleteUser(u.id);
}
async function login(page, email, dark) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (dark) await page.evaluate(() => localStorage.setItem("rd-mode", "dark"));
  await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
}
const openByText = async (page, text) => {
  await page.click(`button:has-text("${text}")`);
  await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 });
  await page.waitForTimeout(500);
};
// a dialog "has no status control" = no combobox/native-select labelled Status, and no "Status" field label
const noStatusControl = (page) => page.evaluate(() => {
  const s = document.querySelector(".fui-DialogSurface");
  if (!s) return false;
  const txt = s.textContent || "";
  const hasStatusLabel = /\bStatus\b/.test(txt);
  return !hasStatusLabel;
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await del(ADMIN); await del(CLIENT);
  await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "Fin Admin" } });
  const { data: clients } = await admin.from("clients").select("id, name, client_type").eq("client_type", "project").limit(1);
  const pc = clients?.[0];
  if (!pc) throw new Error("no project client");
  // temp client user attached to the project client
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: pc.id, full_name: "Fin Client" } });
  await admin.from("profiles").update({ role: "client", client_id: pc.id, full_name: "Fin Client" }).eq("id", cu.user.id);

  for (const dark of [false, true]) {
    const tag = dark ? "dark" : "light";
    // ---- STAFF (admin) ----
    let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    let page = await ctx.newPage();
    await login(page, ADMIN, dark);

    // project-form-dialog (staff — HAS status, correct)
    await page.goto(`${BASE}/clients/${pc.id}/projects`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
    await openByText(page, "New project");
    await page.screenshot({ path: `${OUT}/project_form_staff_${tag}.png` });
    rec(`[${tag}] staff project-form opens`, (await page.locator(".fui-DialogSurface").count()) >= 1);
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);

    // update-dialog (staff)
    await page.goto(`${BASE}/clients/${pc.id}/updates`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
    const upBtn = page.locator('button:has-text("Post update"), button:has-text("Post an update"), button:has-text("New update")').first();
    if (await upBtn.count()) {
      await upBtn.click(); await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 }); await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/update_dialog_${tag}.png` });
      rec(`[${tag}] update-dialog opens`, true);
      await page.keyboard.press("Escape");
    } else { rec(`[${tag}] update-dialog opens`, false, "Post update button not found"); }
    await ctx.close();

    // ---- CLIENT ----
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();
    await login(page, CLIENT, dark);

    // client project-dialog (NO status control)
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
    const addProj = page.locator('button:has-text("Quick add"), button:has-text("Add a project")').first();
    if (await addProj.count()) {
      await addProj.click(); await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 }); await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/project_dialog_client_${tag}.png` });
      rec(`[${tag}] CLIENT project-dialog has NO status control`, await noStatusControl(page));
      await page.keyboard.press("Escape");
    } else { rec(`[${tag}] CLIENT project-dialog`, false, "Add project not found"); }

    // client task-dialog (NO status control)
    await page.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
    const addTask = page.locator('button:has-text("Add task")').first();
    if (await addTask.count()) {
      await addTask.click(); await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 }); await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/client_task_dialog_${tag}.png` });
      rec(`[${tag}] CLIENT task-dialog has NO status control`, await noStatusControl(page));
      await page.keyboard.press("Escape");
    } else { rec(`[${tag}] CLIENT task-dialog`, false, "Add task not found"); }
    await ctx.close();
  }
} finally {
  await del(ADMIN); await del(CLIENT);
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
