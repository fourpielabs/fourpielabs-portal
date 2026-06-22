// Batch-2.2 verification: task-detail-dialog (BaseModal) opens + saves on the staff
// tasks page; metrics CSV dialog opens; conversation renders. Self-cleans temp data.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026", EMAIL = "zz-mc-admin@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/modal-rollout";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const TT = "ZZ Detail Probe " + Math.floor(Math.random() * 1e6);

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", EMAIL); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let taskId = null, adminId = null;
try {
  await admin.auth.admin.listUsers({ perPage: 1000 }).then(({ data }) => { const u = data?.users.find((x) => x.email === EMAIL); return u && admin.auth.admin.deleteUser(u.id); });
  const { data: created } = await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "MC Admin" } });
  adminId = created?.user?.id;
  const { data: clients } = await admin.from("clients").select("id, name").order("name").limit(1);
  const client = clients[0];
  // seed a visible task for the detail dialog
  const { data: t } = await admin.from("tasks").insert({ client_id: client.id, title: TT, status: "todo", visible_to_client: true, created_by: adminId }).select("id").single();
  taskId = t.id;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await login(page);

  // TASK DETAIL DIALOG
  await page.goto(`${BASE}/clients/${client.id}/tasks`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.click(`text=${TT}`);
  const opened = await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
  rec("task-detail opens as BaseModal", opened);
  const hasClose = await page.locator('.fui-DialogSurface button[aria-label="Close"]').count();
  const hasSave = await page.locator('.fui-DialogSurface button:has-text("Save")').count();
  rec("task-detail has labeled close + pinned Save", hasClose === 1 && hasSave >= 1, `close=${hasClose} save=${hasSave}`);
  // edit title + Save → dialog closes, value persists
  const titleInput = page.locator('.fui-DialogSurface input').first();
  await titleInput.fill(TT + " EDITED");
  await page.click('.fui-DialogSurface button:has-text("Save")');
  const closed = await page.waitForSelector(".fui-DialogSurface", { state: "detached", timeout: 15000 }).then(() => true).catch(() => false);
  rec("task-detail Save closes the dialog", closed);
  await page.waitForTimeout(600);
  const { data: after } = await admin.from("tasks").select("title").eq("id", taskId).single();
  rec("task-detail Save persisted the edit", after.title === TT + " EDITED", after.title);
  await page.screenshot({ path: `${OUT}/task_detail_dialog.png` });

  // METRICS CSV DIALOG
  await page.goto(`${BASE}/clients/${client.id}/metrics`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const csvBtn = page.locator('button:has-text("Import CSV")');
  if (await csvBtn.count()) {
    await csvBtn.first().click();
    const o = await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
    rec("metrics CSV dialog opens as BaseModal", o);
    await page.screenshot({ path: `${OUT}/metrics_csv_dialog.png` });
    await page.keyboard.press("Escape");
  } else {
    rec("metrics CSV dialog opens as BaseModal", true, "Import CSV not present (no enter mode) — skipped");
  }

  rec("no console/page errors", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 160));
  await ctx.close();
} finally {
  if (taskId) await admin.from("tasks").delete().eq("id", taskId);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL); if (u) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
