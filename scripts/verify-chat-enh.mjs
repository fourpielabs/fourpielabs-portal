// Dev-only E2E for Phase 5d (chat enhancements: @mentions + attachments). Run a
// server, then: node scripts/verify-chat-enh.mjs
// Boundary-FIRST: a client can NEVER reach an internal-thread attachment (the sixth
// surface). Also: shared attachment downloadable by the client; staff download both;
// @mention notifies; the internal mention picker excludes the client; internal
// activity never notifies the client.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ts = `${Math.floor(Date.now() / 1000)}`;

const results = [];
const rec = (n, ok, d = "") => { results.push({ ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(pred, timeoutMs) { const s = Date.now(); while (Date.now() - s < timeoutMs) { if (await pred()) return true; await wait(400); } return false; }

const premierId = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;
const prof = async (e) => (await admin.from("profiles").select("id, full_name").eq("email", e).single()).data;
const team = await prof("demo-team@example.com");
const client = await prof("demo-client@example.com");
const msgIdByBody = async (body) => (await admin.from("messages").select("id, attachment_path").eq("client_id", premierId).eq("body", body).maybeSingle()).data;

const tmpFile = join(process.cwd(), "e2e-attach.txt");
writeFileSync(tmpFile, `e2e attachment ${ts}`);

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
async function sendWithFile(bodyText) {
  await page.fill("textarea", bodyText);
  await page.setInputFiles('input[type=file]', tmpFile);
  await page.waitForTimeout(400);
  await page.click('button:has-text("Send"), button:has-text("Post internal")');
  await page.waitForTimeout(1600);
}

const internalBody = `E2EENH-internal-att ${ts}`;
const sharedBody = `E2EENH-shared-att ${ts}`;
const mentionBody = `E2EENH-mention ${ts}`;

try {
  await admin.from("messages").delete().like("body", "E2EENH-%");
  await admin.from("notifications").delete().like("title", "%mentioned you%");

  // ---- STAFF authors: internal attachment, shared attachment, a @mention -----
  await login("demo-admin@example.com");
  // internal-thread attachment
  await page.goto(`${BASE}/clients/${premierId}/messages?tab=internal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await sendWithFile(internalBody);
  // shared-thread attachment
  await page.goto(`${BASE}/clients/${premierId}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await sendWithFile(sharedBody);

  const internalMsg = await poll(async () => (await msgIdByBody(internalBody))?.attachment_path, 9000) ? await msgIdByBody(internalBody) : null;
  const sharedMsg = await poll(async () => (await msgIdByBody(sharedBody))?.attachment_path, 9000) ? await msgIdByBody(sharedBody) : null;

  // (1) BOUNDARY — client CANNOT read the internal attachment row (the gate that
  // makes getMessageAttachmentUrlAction return DENIED). READ FIRST.
  const c = createClient(url, anon, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: "demo-client@example.com", password: PASS });
  const cInt = await c.from("messages").select("attachment_path").eq("id", internalMsg?.id ?? "00000000-0000-0000-0000-000000000000");
  rec("INTERNAL attachment → client DENIED (getMessageAttachmentUrlAction gate)", (cInt.data?.length ?? 0) === 0, `${cInt.data?.length ?? 0} rows`);

  // (2) staff can read BOTH attachment rows (→ can sign both)
  const s = createClient(url, anon, { auth: { persistSession: false } });
  await s.auth.signInWithPassword({ email: "demo-team@example.com", password: PASS });
  const sBoth = await s.from("messages").select("id, attachment_path").in("id", [internalMsg?.id, sharedMsg?.id].filter(Boolean));
  rec("staff can read BOTH attachments (download both)", (sBoth.data ?? []).filter((m) => m.attachment_path).length === 2, `${(sBoth.data ?? []).length} rows`);

  // (3) SHARED attachment → client opens a working signed URL (popup)
  await login("demo-client@example.com");
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const [popup] = await Promise.all([
    page.waitForEvent("popup", { timeout: 8000 }).catch(() => null),
    page.locator('button:has-text("e2e-attach.txt")').first().click(),
  ]);
  rec("SHARED attachment → client opens a working signed URL", Boolean(popup), popup ? "popup opened" : "no popup");
  if (popup) await popup.close();

  // ---- @mentions -------------------------------------------------------------
  // (4) @mention in shared thread → mentioned staff notified
  await admin.from("notifications").delete().eq("user_id", team.id).like("title", "%mentioned you%");
  await login("demo-admin@example.com");
  await page.goto(`${BASE}/clients/${premierId}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.locator("textarea").click();
  await page.locator("textarea").pressSequentially(`${mentionBody} @${(team.full_name ?? "Demo").split(" ")[0]}`);
  await page.waitForTimeout(700);
  await page.locator("[data-mention-option]").filter({ hasText: team.full_name ?? "" }).first().click();
  await page.waitForTimeout(300);
  await page.click('button:has-text("Send")');
  const mentioned = await poll(async () => ((await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", team.id).like("title", "%mentioned you%")).count ?? 0) >= 1, 8000);
  rec("@mention in shared thread → mentioned staff NOTIFIED", mentioned, "");

  // (5) internal mention picker EXCLUDES the client (no mentioning a client into internal)
  await page.goto(`${BASE}/clients/${premierId}/messages?tab=internal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.locator("textarea").click();
  await page.locator("textarea").pressSequentially("@");
  await page.waitForTimeout(700);
  const opts = await page.locator("[data-mention-option]").allInnerTexts();
  rec("INTERNAL mention picker EXCLUDES the client", !opts.some((t) => t.includes(client.full_name ?? "@@@")), opts.join(" | ") || "no options");

  // (6) internal activity NEVER notifies the client (no internal-link notifications)
  const cIntNotif = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", client.id).like("link", "%tab=internal%");
  rec("internal activity never notifies the client", (cIntNotif.count ?? 0) === 0, `${cIntNotif.count ?? 0} rows`);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("messages").delete().like("body", "E2EENH-%");
  await admin.from("notifications").delete().like("title", "%mentioned you%");
  try {
    const { data: list } = await admin.storage.from("client-files").list(premierId);
    const stale = (list ?? []).filter((f) => f.name.includes("e2e-attach")).map((f) => `${premierId}/${f.name}`);
    if (stale.length) await admin.storage.from("client-files").remove(stale);
  } catch { /* noop */ }
  try { rmSync(tmpFile); } catch { /* noop */ }
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} chat-enhancement E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All chat-enhancement E2E checks passed. ✓");
