// Dev-only E2E for the gated USER hard-delete (Item 2). Run a server, then:
//   node scripts/verify-delete.mjs
// Creates a throwaway accepted user + authored content + personal state, deletes
// it via the ADMIN UI (type-the-name confirm dialog), and asserts: personal state
// is cascade-erased, authored content SURVIVES un-attributed (created_by null),
// the audit row exists, the type-to-confirm guardrail gates the button, and the
// admin's own row offers NO Delete (self-guard).
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
const email = `e2e-del-${ts}@example.com`;
const fullName = `E2E Delete Target ${ts}`;
const delTitle = `E2EDEL-deliverable ${ts}`;

async function delUserByEmail(e) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === e);
  if (u) await admin.auth.admin.deleteUser(u.id);
}
const userExists = async (e) => {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return Boolean(data?.users.find((x) => x.email === e));
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
async function login(e) {
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", e);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
}

let uid;
try {
  await delUserByEmail(email);
  await admin.from("deliverables").delete().like("title", "E2EDEL-%");

  // throwaway ACCEPTED user (email_confirm → not pending → gets the delete control)
  const cu = await admin.auth.admin.createUser({
    email, password: "E2eDelTarget!123", email_confirm: true,
    user_metadata: { role: "team", client_id: null, full_name: fullName },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  uid = cu.data.user.id;
  await wait(400); // let handle_new_user seed the profile

  // authored content (must SURVIVE) + personal state (must be ERASED)
  await admin.from("deliverables").insert({ client_id: premierId, title: delTitle, type: "other", status: "pending", created_by: uid });
  await admin.from("notifications").insert({ user_id: uid, type: "message", title: "E2EDEL-note" });
  await admin.from("notification_preferences").insert({ user_id: uid, email_message: false });
  await admin.from("client_assignments").insert({ client_id: premierId, user_id: uid });

  await login("demo-admin@example.com");
  await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // self-guard: the admin's OWN row offers no Delete (shows "You")
  const ownRow = page.locator("tr", { hasText: "demo-admin@example.com" });
  const ownDelete = await ownRow.getByRole("button", { name: "Delete" }).count();
  rec("admin's OWN row offers NO Delete (self-guard)", ownDelete === 0, `${ownDelete} delete btn(s)`);

  // open the throwaway user's Delete dialog
  const row = page.locator("tr", { hasText: email });
  await row.getByRole("button", { name: "Delete" }).first().click();
  await page.waitForTimeout(500);

  // guardrail: the confirm button is DISABLED until the exact name is typed
  const confirmBtn = page.locator('button:has-text("Delete permanently")');
  rec("type-to-confirm: button DISABLED before typing the name", await confirmBtn.isDisabled(), "");
  await page.fill("#confirm-phrase", "not the name");
  rec("type-to-confirm: still DISABLED with a wrong value", await confirmBtn.isDisabled(), "");
  await page.fill("#confirm-phrase", fullName);
  await page.waitForTimeout(200);
  rec("type-to-confirm: ENABLED once the exact name matches", !(await confirmBtn.isDisabled()), "");
  await confirmBtn.click();

  await poll(async () => !(await userExists(email)), 10000);

  // assertions ----------------------------------------------------------------
  rec("auth user is gone", !(await userExists(email)), "");
  rec("profiles row is gone", ((await admin.from("profiles").select("id").eq("id", uid)).data?.length ?? 0) === 0, "");
  rec("notifications cascade-erased", ((await admin.from("notifications").select("id").eq("user_id", uid)).data?.length ?? 0) === 0, "");
  rec("notification_preferences cascade-erased", ((await admin.from("notification_preferences").select("user_id").eq("user_id", uid)).data?.length ?? 0) === 0, "");
  rec("client_assignments cascade-erased", ((await admin.from("client_assignments").select("user_id").eq("user_id", uid)).data?.length ?? 0) === 0, "");

  const { data: del } = await admin.from("deliverables").select("id, created_by").eq("title", delTitle).maybeSingle();
  rec("authored deliverable SURVIVES as 'Removed user' (created_by null)", Boolean(del) && del.created_by === null, `created_by=${del?.created_by ?? "(gone)"}`);

  const { count: auditCount } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "user.deleted").eq("entity_id", uid);
  rec("audit_log has the user.deleted row", (auditCount ?? 0) >= 1, `${auditCount ?? 0} rows`);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await delUserByEmail(email);
  await admin.from("deliverables").delete().like("title", "E2EDEL-%");
  await admin.from("notifications").delete().eq("title", "E2EDEL-note");
  if (uid) await admin.from("audit_log").delete().eq("action", "user.deleted").eq("entity_id", uid);
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} delete E2E checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("User hard-delete: cascade erases personal state, authored content survives, audit kept. ✓");
