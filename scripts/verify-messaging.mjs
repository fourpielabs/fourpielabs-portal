// Dev-only E2E for 4c messaging UI. Never ships.
//   node scripts/verify-messaging.mjs   (server on :3000, or VERIFY_BASE)
// Client sees ONLY their shared thread (not internal) + can post; staff get the
// dual-thread surface with an unmistakable Internal treatment. (Live Realtime
// delivery is proven separately by verify-realtime.ts.)
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ts = process.env.VERIFY_TS || `${Math.floor(Date.now() / 1000)}`;
mkdirSync("screenshots/verify-messaging", { recursive: true });

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
const premierId = premier.id;
const tid = async (type) => (await admin.from("threads").select("id").eq("client_id", premierId).eq("type", type).single()).data.id;
const sharedThread = await tid("client_shared");
const internalThread = await tid("internal");
const adminUid = (await admin.from("profiles").select("id").eq("email", "demo-admin@example.com").single()).data.id;

const sharedBody = `MSG-shared-seed ${ts}`;
const internalBody = `MSG-internal-seed ${ts}`;
const clientMsg = `client-says-hi ${ts}`;
async function cleanup() {
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "MSG-%");
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "client-says-hi%");
  await admin.from("notifications").delete().eq("type", "message").like("body", "client-says-hi%");
}
await cleanup();
await admin.from("messages").insert([
  { thread_id: sharedThread, client_id: premierId, thread_type: "client_shared", author_id: adminUid, body: sharedBody },
  { thread_id: internalThread, client_id: premierId, thread_type: "internal", author_id: adminUid, body: internalBody },
]);

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function makePage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.login = async (email) => {
    await ctx.clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("input[type=email]", email);
    await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(900);
  };
  page.ctx = ctx;
  return page;
}

try {
  const page = await makePage(1440, 900);
  const shot = (t) => page.screenshot({ path: `screenshots/verify-messaging/${t}.png`, fullPage: true });

  // CLIENT — sees shared, NOT internal; can post
  await page.login("demo-client@example.com");
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await shot("1_client_messages_1440");
  const c1 = await page.locator("body").innerText();
  rec("client sees shared message", c1.includes(sharedBody), "");
  rec("client does NOT see internal message", !c1.includes(internalBody), "");
  rec("client composer marked 'Visible to the client'", /Visible to the client/i.test(c1), "");

  await page.fill("textarea", clientMsg);
  await page.click('button:has-text("Send")');
  await page.waitForTimeout(1800);
  await shot("2_client_posted_1440");
  rec("client post appears in the thread", (await page.locator("body").innerText()).includes(clientMsg), "");

  // STAFF — dual thread; Internal distinct + hidden from client
  await page.login("demo-admin@example.com");
  await page.goto(`${BASE}/clients/${premierId}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await shot("3_staff_client_tab_1440");
  const s1 = await page.locator("body").innerText();
  rec("staff Client tab shows shared message", s1.includes(sharedBody), "");
  rec("staff Client tab marked 'Visible to the client'", /Visible to the client/i.test(s1), "");
  rec("staff sees the client's posted message", s1.includes(clientMsg), "");

  await page.goto(`${BASE}/clients/${premierId}/messages?tab=internal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await shot("4_staff_internal_tab_1440");
  const s2 = await page.locator("body").innerText();
  rec("staff Internal tab shows internal message", s2.includes(internalBody), "");
  rec("staff Internal tab warns the client cannot see it", /the client cannot see this/i.test(s2), "");
  await page.ctx.close();

  // @390 screenshots of the two key surfaces
  const m = await makePage(390, 844);
  const mshot = (t) => m.screenshot({ path: `screenshots/verify-messaging/${t}.png`, fullPage: true });
  await m.login("demo-client@example.com");
  await m.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await m.waitForTimeout(1200);
  await mshot("5_client_messages_390");
  await m.login("demo-admin@example.com");
  await m.goto(`${BASE}/clients/${premierId}/messages?tab=internal`, { waitUntil: "networkidle" });
  await m.waitForTimeout(1000);
  await mshot("6_staff_internal_390");
  await m.ctx.close();
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await cleanup();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} messaging E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("All messaging E2E checks passed. ✓");
