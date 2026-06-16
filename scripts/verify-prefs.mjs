// Dev-only E2E for 4e email preferences. Never ships.
// Run the SERVER with EMAIL_CAPTURE=1 EMAIL_CAPTURE_FILE=.email-capture.jsonl, then:
//   node scripts/verify-prefs.mjs
// Asserts the THREE cases — esp. the critical absence-of-row = SEND default (a new user
// with no pref row still gets emails), plus toggle-off-suppresses (bell still inserts) and
// toggle-on-resumes; + a settings-UI save smoke.
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
async function pollCapture(pred, timeoutMs) { const s = Date.now(); while (Date.now() - s < timeoutMs) { if (pred(readCapture())) return true; await wait(400); } return false; }

const CLIENT = "demo-client@example.com";
const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
const premierId = premier.id;
const clientUid = (await admin.from("profiles").select("id").eq("email", CLIENT).single()).data.id;

const clearWindow = () => admin.from("notifications").delete().eq("user_id", clientUid).eq("type", "message").eq("link", "/messages");
const clientNoteCount = async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", clientUid).eq("type", "message").eq("link", "/messages")).count ?? 0;
const setPref = (on) => admin.from("notification_preferences").upsert({ user_id: clientUid, email_message: on }, { onConflict: "user_id" });
const clearPref = () => admin.from("notification_preferences").delete().eq("user_id", clientUid);
const clientEmailed = () => readCapture().some((e) => e.to === CLIENT && e.type === "message");

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
async function staffPostShared(text) {
  await page.goto(`${BASE}/clients/${premierId}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.fill("textarea", text);
  await page.click('button:has-text("Send")');
  await page.waitForTimeout(1500);
}

try {
  await login("demo-admin@example.com");

  // (1) DEFAULT (no pref row) → client EMAILED + in-app row inserts (the critical path)
  await clearPref(); await clearWindow(); clearCapture();
  await staffPostShared(`pref-default ${ts}`);
  await pollCapture(clientEmailed, 9000);
  rec("DEFAULT (no pref row) → client EMAILED (absence-of-row = SEND)", clientEmailed(), "");
  rec("DEFAULT → in-app bell row still inserts", (await clientNoteCount()) >= 1, "");

  // (2) OFF → NO email, but in-app row STILL inserts (email-only gating)
  await setPref(false); await clearWindow(); clearCapture();
  await staffPostShared(`pref-off ${ts}`);
  await wait(3500);
  rec("OFF → client NOT emailed (preference suppresses the email)", !clientEmailed(), `${readCapture().filter((e) => e.to === CLIENT).length} client emails`);
  rec("OFF → in-app bell row STILL inserts (preference is email-only)", (await clientNoteCount()) >= 1, "");

  // (3) ON → email resumes
  await setPref(true); await clearWindow(); clearCapture();
  await staffPostShared(`pref-on ${ts}`);
  await pollCapture(clientEmailed, 9000);
  rec("ON → client emailed again (preference resumes)", clientEmailed(), "");

  // (4) settings UI smoke: client toggles New messages off + saves → DB reflects
  await clearPref();
  await login(CLIENT);
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator('button[role="switch"][aria-label="New messages"]').click();
  await page.click('button:has-text("Save preferences")');
  await page.waitForTimeout(1500);
  const { data: pref } = await admin.from("notification_preferences").select("email_message").eq("user_id", clientUid).maybeSingle();
  rec("settings UI: toggle off → DB row email_message = false", pref?.email_message === false, `${pref?.email_message}`);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("messages").delete().eq("client_id", premierId).like("body", `pref-%${ts}`);
  await clearWindow();
  await clearPref();
  try { clearCapture(); } catch { /* noop */ }
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} preference E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All preference E2E checks passed. ✓");
