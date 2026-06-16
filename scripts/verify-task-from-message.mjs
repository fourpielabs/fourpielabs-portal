// Dev-only E2E for Phase 5c (create-task-from-message bridge). Run a server, then:
//   node scripts/verify-task-from-message.mjs
// Asserts: a CLIENT creates a task from a shared message → task linked
// (source_message_id) + staff notified; a STAFF member creates a task from an
// INTERNAL message → the task is staff-only (visible_to_client=false) and the
// client NEVER sees it (the internal-thread boundary extends to tasks).
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
const adminUid = (await admin.from("profiles").select("id").eq("email", "demo-admin@example.com").single()).data.id;
const tid = async (type) => (await admin.from("threads").select("id").eq("client_id", premierId).eq("type", type).single()).data.id;
const premierShared = await tid("client_shared");
const premierInternal = await tid("internal");

const taskBySource = async (msgId) => (await admin.from("tasks").select("id, title, visible_to_client, client_id, source_message_id").eq("source_message_id", msgId).maybeSingle()).data;
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
async function createTaskFromLastMessage() {
  await page.locator('button[aria-label="Create task from message"]').last().click();
  await page.waitForTimeout(400);
  await page.click('button:has-text("Create task")');
  await page.waitForTimeout(1200);
}

let sharedMsgId, internalMsgId;
try {
  // seed the LATEST message in each premier thread (authored by staff)
  await admin.from("messages").delete().like("body", "E2EMSG-%");
  const ins = await admin.from("messages").insert([
    { thread_id: premierShared, client_id: premierId, thread_type: "client_shared", author_id: adminUid, body: `E2EMSG-shared ${ts}` },
    { thread_id: premierInternal, client_id: premierId, thread_type: "internal", author_id: adminUid, body: `E2EMSG-internal ${ts}` },
  ]).select("id, thread_type");
  sharedMsgId = ins.data.find((m) => m.thread_type === "client_shared").id;
  internalMsgId = ins.data.find((m) => m.thread_type === "internal").id;
  await admin.from("tasks").delete().in("source_message_id", [sharedMsgId, internalMsgId]);
  await admin.from("notifications").delete().like("title", "Client added a task%");

  // (1) CLIENT creates a task from their SHARED message
  await login("demo-client@example.com");
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await createTaskFromLastMessage();
  const linked = await poll(async () => Boolean(await taskBySource(sharedMsgId)), 9000);
  rec("client task-from-message → task LINKED to source message", linked, "");
  const ct = await taskBySource(sharedMsgId);
  rec("linked task is client-visible + own client", ct?.visible_to_client === true && ct?.client_id === premierId, `${ct?.visible_to_client}`);
  rec("staff NOTIFIED of the client's task-from-message", await poll(staffNotified, 6000), "");

  // (2) STAFF creates a task from an INTERNAL message → staff-only + invisible to client
  await login("demo-admin@example.com");
  await page.goto(`${BASE}/clients/${premierId}/messages?tab=internal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await createTaskFromLastMessage();
  const intLinked = await poll(async () => Boolean(await taskBySource(internalMsgId)), 9000);
  const it = await taskBySource(internalMsgId);
  rec("staff task-from-INTERNAL-message → task created", intLinked, "");
  rec("internal-source task is staff-only (visible_to_client=false)", it?.visible_to_client === false, `${it?.visible_to_client}`);

  // client NEVER sees the internal-derived task — BOUNDARY
  await login("demo-client@example.com");
  await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  rec("client NEVER sees the internal-derived task — BOUNDARY", !body.includes(`E2EMSG-internal ${ts}`), "");
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  if (sharedMsgId || internalMsgId) await admin.from("tasks").delete().in("source_message_id", [sharedMsgId, internalMsgId].filter(Boolean));
  await admin.from("notifications").delete().like("title", "Client added a task%");
  await admin.from("messages").delete().like("body", "E2EMSG-%");
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} task-from-message E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All task-from-message E2E checks passed. ✓");
