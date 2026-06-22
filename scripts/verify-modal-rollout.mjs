// Batch-2 dialog rollout verification. Dev-only, self-cleans temp admin.
// Verifies a FormDialog consumer (deliverable create) OPENS as a BaseModal, has a
// labeled close X, SUBMITS via the pinned-footer form-id association (creates a row),
// and that a ConfirmDelete opens. Screens representative dialogs.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026", EMAIL = "zz-mr-admin@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/modal-rollout";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const TITLE = "ZZ Modal Rollout Probe " + Math.floor(Math.random() * 1e6);

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", EMAIL); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let createdId = null;
try {
  await admin.auth.admin.listUsers({ perPage: 1000 }).then(({ data }) => { const u = data?.users.find((x) => x.email === EMAIL); return u && admin.auth.admin.deleteUser(u.id); });
  await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "MR Admin" } });
  const { data: clients } = await admin.from("clients").select("id, name").order("name").limit(1);
  const client = clients?.[0];
  if (!client) throw new Error("no client to test against");

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await login(page);

  await page.goto(`${BASE}/clients/${client.id}/deliverables`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // OPEN the New-deliverable FormDialog (now a BaseModal)
  await page.click('button:has-text("New deliverable")');
  await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 6000 });
  await page.waitForTimeout(400);
  const hasClose = await page.locator('.fui-DialogSurface button[aria-label="Close"]').count();
  const hasTitle = await page.locator('.fui-DialogSurface:has-text("New deliverable")').count();
  rec("FormDialog opens as BaseModal", (await page.locator(".fui-DialogSurface").count()) >= 1);
  rec("BaseModal has labeled close X", hasClose === 1, `close=${hasClose}`);
  rec("dialog shows the title", hasTitle >= 1);
  await page.screenshot({ path: `${OUT}/deliverable_create_dialog.png` });

  // FILL title + SUBMIT via the pinned footer button (form-id association)
  await page.fill('.fui-DialogSurface input[name="title"], .fui-DialogSurface input#title, .fui-DialogSurface input', TITLE);
  await page.click('.fui-DialogSurface button:has-text("Create")');
  // dialog should close on success
  const closed = await page.waitForSelector(".fui-DialogSurface", { state: "detached", timeout: 8000 }).then(() => true).catch(() => false);
  rec("submit via pinned footer closes the dialog (form-id association works)", closed);
  await page.waitForTimeout(800);

  // confirm the row persisted (RLS-scoped via service role read)
  const { data: created } = await admin.from("deliverables").select("id, title").eq("client_id", client.id).eq("title", TITLE).maybeSingle();
  createdId = created?.id ?? null;
  rec("deliverable row created (RPC/action ran)", !!createdId, createdId ? "persisted" : "NOT found");

  // OPEN a ConfirmDelete (BaseModal sm) on the new row
  if (createdId) {
    await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(700);
    const delBtn = page.locator('button[aria-label="Delete"]').first();
    if (await delBtn.count()) {
      await delBtn.click();
      const opened = await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
      rec("ConfirmDelete opens as BaseModal", opened);
      await page.screenshot({ path: `${OUT}/deliverable_confirm_delete.png` });
      await page.keyboard.press("Escape");
    } else {
      rec("ConfirmDelete opens as BaseModal", false, "no delete button found");
    }
  }

  rec("no console/page errors during dialog flow", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 160));
  await ctx.close();
} finally {
  if (createdId) await admin.from("deliverables").delete().eq("id", createdId);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL); if (u) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
