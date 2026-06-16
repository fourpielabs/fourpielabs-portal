// Dev-only E2E for Phase 5b (Tasks UI both sides). Run a server, then:
//   node scripts/verify-tasks.mjs
// Asserts: staff create-task UI works; a client sees their assigned + visible tasks;
// a staff-only (visible_to_client=false) task is NEVER shown to the client (the
// boundary); a client can change a task's status from their board.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const rec = (n, ok, d = "") => { results.push({ ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(pred, timeoutMs) { const s = Date.now(); while (Date.now() - s < timeoutMs) { if (await pred()) return true; await wait(400); } return false; }

const premierId = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;
const clientUid = (await admin.from("profiles").select("id").eq("email", "demo-client@example.com").single()).data.id;

const cleanup = () => admin.from("tasks").delete().like("title", "E2ETASK%");
const taskByTitle = async (title) => (await admin.from("tasks").select("id, status, visible_to_client").eq("client_id", premierId).eq("title", title).maybeSingle()).data;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
async function login(email) {
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
}

try {
  await cleanup();
  // fixtures: a visible task assigned to the client, and a staff-only (hidden) one
  await admin.from("tasks").insert([
    { client_id: premierId, title: "E2ETASK-visible", assignee_id: clientUid, visible_to_client: true, status: "todo" },
    { client_id: premierId, title: "E2ETASK-hidden", visible_to_client: false, status: "todo" },
  ]);

  // (1) STAFF create-task via the per-client Tasks tab UI
  await login("demo-admin@example.com");
  await page.goto(`${BASE}/clients/${premierId}/tasks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.click('button:has-text("New task")');
  await page.fill("#t-title", "E2ETASK-uicreate");
  await page.click('button:has-text("Create")');
  const created = await poll(async () => Boolean(await taskByTitle("E2ETASK-uicreate")), 9000);
  rec("staff create-task UI → row created", created, "");
  const uirow = await taskByTitle("E2ETASK-uicreate");
  rec("staff-created task defaults visible_to_client=true", uirow?.visible_to_client === true, `${uirow?.visible_to_client}`);

  // (2) CLIENT sees assigned + visible tasks, NOT the staff-only one (the boundary)
  await login("demo-client@example.com");
  await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  rec("client sees their assigned/visible task", body.includes("E2ETASK-visible"), "");
  rec("client sees the staff-created visible task", body.includes("E2ETASK-uicreate"), "");
  rec("client NEVER sees the staff-only (hidden) task — BOUNDARY", !body.includes("E2ETASK-hidden"), "");

  // (3) CLIENT changes a task's status from their board
  await page.locator('button[aria-label="Status for E2ETASK-visible"]').click();
  await page.getByRole("option", { name: "Done" }).click();
  const done = await poll(async () => (await taskByTitle("E2ETASK-visible"))?.status === "done", 9000);
  rec("client status change → DB reflects 'done'", done, `${(await taskByTitle("E2ETASK-visible"))?.status}`);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await cleanup();
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} task E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All task E2E checks passed. ✓");
