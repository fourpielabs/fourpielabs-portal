// Dev-only E2E for 4b notifications. Never ships.
//   node scripts/verify-notifications.mjs   (server on :3000, or VERIFY_BASE)
// Real integration: a client APPROVES a deliverable (a real UI-backed event) →
// assigned staff get a `deliverable_approved` notification, the client (author)
// does NOT, and the staff bell shows it + mark-all clears it.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ts = process.env.VERIFY_TS || `${Math.floor(Date.now() / 1000)}`;
mkdirSync("screenshots/verify-notifications", { recursive: true });

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const prof = async (email) => (await admin.from("profiles").select("id").eq("email", email).single()).data.id;
async function pollUntil(fn, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
const premierId = premier.id;
const clientUid = await prof("demo-client@example.com");
const teamUid = await prof("demo-team@example.com");
const countApproved = async (uid) => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("type", "deliverable_approved").eq("user_id", uid)).count ?? 0;
const countUnread = async (uid) => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("type", "deliverable_approved").eq("user_id", uid).is("read_at", null)).count ?? 0;

// fixture: a visible needs_review deliverable on premier; clean prior runs
await admin.from("deliverables").delete().eq("client_id", premierId).like("title", "E2E Notify%");
await admin.from("notifications").delete().eq("type", "deliverable_approved").in("user_id", [teamUid, clientUid]);
const delTitle = `E2E Notify ${ts}`;
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
const shot = (tag) => page.screenshot({ path: `screenshots/verify-notifications/${tag}.png`, fullPage: true });

try {
  // 1) client approves the deliverable (real event) → staff notified
  await login("demo-client@example.com");
  await page.goto(`${BASE}/deliverables`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const row = page.locator("li").filter({ hasText: delTitle });
  await row.getByRole("button", { name: /approve/i }).first().click();
  await page.waitForTimeout(1000);
  await shot("1_client_approved");

  // poll — the server action + notify() insert are async
  const staffNotified = await pollUntil(async () => (await countApproved(teamUid)) >= 1, 10000);
  rec("approve → assigned staff (team) notified", staffNotified, `team=${await countApproved(teamUid)}`);
  rec("approve → author/client NOT notified (staff-only event)", (await countApproved(clientUid)) === 0, `client=${await countApproved(clientUid)}`);

  // 2) bell: staff sees it, then mark-all clears
  await login("demo-team@example.com");
  await page.waitForTimeout(600);
  await page.locator('button[aria-label*="Notifications"]').first().click();
  await page.waitForTimeout(700);
  await shot("2_staff_bell");
  const body = await page.locator("body").innerText();
  rec("staff bell shows the deliverable-approved notification", /Deliverable approved/i.test(body), "");
  await page.locator('button:has-text("Mark all read")').first().click().catch(() => {});
  const cleared = await pollUntil(async () => (await countUnread(teamUid)) === 0, 8000);
  rec("mark-all read clears unread (DB read_at set)", cleared, `${await countUnread(teamUid)} unread`);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("deliverables").delete().eq("client_id", premierId).like("title", "E2E Notify%");
  await admin.from("notifications").delete().eq("type", "deliverable_approved").in("user_id", [teamUid, clientUid]);
  await ctx.close();
  await browser.close();
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All notification E2E checks passed. ✓");
