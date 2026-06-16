// Dev-only E2E for Batch 2 (chat edit + soft-delete). Run a server, then:
//   node scripts/verify-msg-edit-delete.mjs
// Drives the client UI: edit own message → DB body + edited_at + "edited" indicator;
// delete own message → DB deleted_at (soft) + removed from the UI + absent from a
// signed-in STAFF read (cross-party vanish). The author-only/boundary denials are in
// test:rls (199); this proves the UI flow + cross-party disappearance.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ts = `${Math.floor(Date.now() / 1000)}`;

const results = [];
const rec = (n, ok, d = "") => { results.push({ ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const premierId = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;
const clientUid = (await admin.from("profiles").select("id").eq("email", "demo-client@example.com").single()).data.id;
const premierShared = (await admin.from("threads").select("id").eq("client_id", premierId).eq("type", "client_shared").single()).data.id;
const body0 = `E2EED-original ${ts}`, body1 = `E2EED-edited ${ts}`;
const row = async () => (await admin.from("messages").select("body, edited_at, deleted_at").eq("id", msgId).single()).data;

let msgId;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
try {
  await admin.from("messages").delete().like("body", "E2EED-%");
  msgId = (await admin.from("messages").insert({ thread_id: premierShared, client_id: premierId, thread_type: "client_shared", author_id: clientUid, body: body0 }).select("id").single()).data.id;

  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", "demo-client@example.com");
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // EDIT
  await page.locator('button[aria-label="Edit message"]').last().click();
  await page.waitForTimeout(300);
  await page.locator('textarea:not([placeholder*="Write"])').fill(body1);
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(1300);
  const afterEdit = await row();
  rec("client edit → DB body updated + edited_at set", afterEdit.body === body1 && afterEdit.edited_at !== null, `edited_at=${afterEdit.edited_at ? "set" : "null"}`);
  rec('UI shows the "· edited" indicator', await page.getByText("· edited").first().isVisible().catch(() => false), "");

  // DELETE (soft)
  await page.locator('button[aria-label="Delete message"]').last().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  // poll for the soft-delete to persist (robust to function↔DB latency)
  let afterDel = await row();
  for (let i = 0; i < 20 && !afterDel?.deleted_at; i++) { await wait(400); afterDel = await row(); }
  rec("client delete → DB deleted_at set (soft, body kept)", afterDel.deleted_at !== null && afterDel.body === body1, `deleted_at=${afterDel.deleted_at ? "set" : "null"}`);
  await page.waitForTimeout(400);
  rec("deleted message removed from the client UI", !(await page.getByText(body1, { exact: false }).isVisible().catch(() => false)), "");

  // cross-party: a signed-in STAFF read excludes the soft-deleted message
  const team = createClient(url, anon, { auth: { persistSession: false } });
  await team.auth.signInWithPassword({ email: "demo-team@example.com", password: PASS });
  const staffSees = await team.from("messages").select("id").eq("id", msgId);
  rec("deleted message absent from STAFF read (cross-party vanish)", (staffSees.data?.length ?? 0) === 0, `${staffSees.data?.length ?? 0} rows`);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("messages").delete().like("body", "E2EED-%");
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} edit/delete E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("Chat edit + soft-delete work; deleted messages vanish for everyone. ✓");
