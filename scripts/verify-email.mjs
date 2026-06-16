// Dev-only E2E for 4d email notifications. Never ships.
// Run the SERVER with EMAIL_CAPTURE=1 EMAIL_CAPTURE_FILE=.email-capture.jsonl, then:
//   node scripts/verify-email.mjs
// sendNotificationEmail records to the capture file instead of calling Resend, so we can
// assert WHO is emailed (the fourth-channel boundary), the THROTTLE cap, and NO body.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const CAPTURE = process.env.EMAIL_CAPTURE_FILE || ".email-capture.jsonl";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ts = `${Math.floor(Date.now() / 1000)}`;

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const clearCapture = () => writeFileSync(CAPTURE, "");
const readCapture = () => (existsSync(CAPTURE) ? readFileSync(CAPTURE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollCapture(pred, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { if (pred(readCapture())) return true; await wait(400); }
  return false;
}

const CLIENT = "demo-client@example.com";
const TEAM = "demo-team@example.com";
const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
const premierId = premier.id;
const clientUid = (await admin.from("profiles").select("id").eq("email", CLIENT).single()).data.id;

// deliverable fixture for the approve test
await admin.from("deliverables").delete().eq("client_id", premierId).like("title", "E2E Email%");
await admin.from("notifications").delete().eq("type", "deliverable_approved").eq("user_id", (await admin.from("profiles").select("id").eq("email", TEAM).single()).data.id);
const delTitle = `E2E Email ${ts}`;
await admin.from("deliverables").insert({ client_id: premierId, title: delTitle, type: "other", status: "needs_review", visible_to_client: true });

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
  await page.waitForTimeout(900);
}
async function postMessage(text, internal) {
  if (internal) await page.goto(`${BASE}/clients/${premierId}/messages?tab=internal`, { waitUntil: "networkidle" });
  else await page.goto(`${BASE}/clients/${premierId}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.fill("textarea", text);
  await page.click(internal ? 'button:has-text("Post internal")' : 'button:has-text("Send")');
  await page.waitForTimeout(1200);
}

try {
  await login("demo-admin@example.com");

  // (1) INTERNAL → staff emailed, client NEVER, no body
  clearCapture();
  const secretInternal = `internal-secret ${ts}`;
  await postMessage(secretInternal, true);
  await pollCapture((c) => c.some((e) => e.to === TEAM && e.type === "message"), 9000);
  const c1 = readCapture();
  rec("INTERNAL → staff emailed", c1.some((e) => e.to === TEAM && e.type === "message"), `${c1.length} sent`);
  rec("INTERNAL → client NEVER emailed (fourth-channel boundary)", !c1.some((e) => e.to === CLIENT), "");
  rec("INTERNAL email carries NO message body", !c1.some((e) => e.html.includes(secretInternal)), "");

  // (2) SHARED → client emailed, no body
  clearCapture();
  const secretShared = `shared-secret ${ts}`;
  await postMessage(secretShared, false);
  await pollCapture((c) => c.some((e) => e.to === CLIENT && e.type === "message"), 9000);
  const c2 = readCapture();
  rec("SHARED → client emailed (link, no body)", c2.some((e) => e.to === CLIENT && e.type === "message"), "");
  rec("SHARED email carries NO message body", !c2.some((e) => e.html.includes(secretShared)), "");

  // (3) THROTTLE — clear the window, post 3 rapid → client emailed at most once
  await admin.from("notifications").delete().eq("user_id", clientUid).eq("type", "message").eq("link", "/messages");
  clearCapture();
  for (let i = 0; i < 3; i++) await postMessage(`burst ${i} ${ts}`, false);
  await wait(2500);
  const c3 = readCapture().filter((e) => e.to === CLIENT && e.type === "message");
  rec("THROTTLE: 3 rapid messages → client emailed AT MOST once", c3.length === 1, `emails=${c3.length}`);

  // (4) deliverable approved → staff emailed
  clearCapture();
  await login(CLIENT);
  await page.goto(`${BASE}/deliverables`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator("li").filter({ hasText: delTitle }).getByRole("button", { name: /approve/i }).first().click();
  await pollCapture((c) => c.some((e) => e.to === TEAM && e.type === "deliverable_approved"), 10000);
  const c4 = readCapture();
  rec("deliverable approved → staff emailed", c4.some((e) => e.to === TEAM && e.type === "deliverable_approved"), "");
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("deliverables").delete().eq("client_id", premierId).like("title", "E2E Email%");
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "%-secret " + ts);
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "burst%" + ts);
  try { clearCapture(); } catch { /* noop */ }
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} email E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All email E2E checks passed. ✓");
