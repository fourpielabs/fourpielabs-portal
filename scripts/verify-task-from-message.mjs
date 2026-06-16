// Dev-only E2E for the chat→tasks toolbar button (Batch 4 retarget of the old
// per-message bridge). Run a server, then: node scripts/verify-task-from-message.mjs
// Create-task is now a single COMPOSER-TOOLBAR button (source-less) — the per-message
// option was removed. Asserts: a CLIENT creates a task from the toolbar on their shared
// thread → client-visible + staff notified; a STAFF member creates a task from the
// toolbar on the INTERNAL thread → the task is staff-only (visible_to_client=false) and
// the client NEVER sees it (the internal-thread boundary still extends to tasks — the
// assertion that matters).
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ts = `${Math.floor(Date.now() / 1000)}`;

const results = [];
const rec = (n, ok, d = "") => { results.push({ ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(pred, timeoutMs) { const s = Date.now(); while (Date.now() - s < timeoutMs) { if (await pred()) return true; await wait(400); } return false; }

const premierId = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;

// no source link anymore — the toolbar prefills the title from the composer text, so we
// locate the created task by that (unique) title.
const clientTitle = `E2ETB-client ${ts}`;
const internalTitle = `E2ETB-internal ${ts}`;
const taskByTitle = async (title) => (await admin.from("tasks").select("id, title, visible_to_client, client_id").eq("client_id", premierId).eq("title", title).maybeSingle()).data;
const staffNotified = async () => ((await admin.from("notifications").select("id", { count: "exact", head: true }).like("title", "Client added a task%").eq("link", `/clients/${premierId}/tasks`)).count ?? 0) >= 1;

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
// type a unique body in the composer → open the toolbar task dialog (title prefills from
// it) → submit. No source link is created (general task).
async function createTaskFromToolbar(titleText) {
  await page.locator("textarea").first().fill(titleText);
  await page.locator('button[aria-label="Create a task"]').click();
  await page.waitForTimeout(500);
  await page.click('button:has-text("Create task")');
  await page.waitForTimeout(1200);
}

try {
  await admin.from("tasks").delete().like("title", "E2ETB-%");
  await admin.from("notifications").delete().like("title", "Client added a task%");

  // (1) CLIENT creates a task from the toolbar on their SHARED thread
  await login("demo-client@example.com");
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await createTaskFromToolbar(clientTitle);
  const created = await poll(async () => Boolean(await taskByTitle(clientTitle)), 9000);
  rec("client toolbar task → created", created, "");
  const ct = await taskByTitle(clientTitle);
  rec("client task is client-visible + own client", ct?.visible_to_client === true && ct?.client_id === premierId, `${ct?.visible_to_client}`);
  rec("staff NOTIFIED of the client's task", await poll(staffNotified, 6000), "");

  // (2) STAFF creates a task from the toolbar on the INTERNAL thread → staff-only
  await login("demo-admin@example.com");
  await page.goto(`${BASE}/clients/${premierId}/messages?tab=internal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await createTaskFromToolbar(internalTitle);
  const intCreated = await poll(async () => Boolean(await taskByTitle(internalTitle)), 9000);
  const it = await taskByTitle(internalTitle);
  rec("staff toolbar task on INTERNAL thread → created", intCreated, "");
  rec("internal-thread task is staff-only (visible_to_client=false)", it?.visible_to_client === false, `${it?.visible_to_client}`);

  // client NEVER sees the internal task — BOUNDARY (the assertion that matters)
  await login("demo-client@example.com");
  await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  rec("client NEVER sees the internal-thread task — BOUNDARY", !body.includes(internalTitle), "");
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("tasks").delete().like("title", "E2ETB-%");
  await admin.from("notifications").delete().like("title", "Client added a task%");
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} toolbar-task E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All toolbar-task E2E checks passed. ✓");
