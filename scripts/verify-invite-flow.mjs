// Dev-only E2E for the invite/recovery → set-password flow. Run a server, then:
//   node scripts/verify-invite-flow.mjs
// Walks BOTH the invite and recovery email links end to end with REAL tokens
// (admin.generateLink — no email actually sent) and asserts each lands on the
// SET-PASSWORD FORM (not /dashboard), then sets a password → /dashboard.
// Throwaway users are created + deleted. This is the "actually walk it" test.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ts = `${Math.floor(Date.now() / 1000)}`;
const NEWPASS = "E2eFlow!Verify123";
const INITIAL = "E2eFlow!Initial123";

const results = [];
const rec = (n, ok, d = "") => { results.push({ ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

async function delUser(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === email);
  if (u) await admin.auth.admin.deleteUser(u.id);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Walk one email link exactly as a recipient would: GET the /auth/confirm
// interstitial with the real token_hash, click Continue (POST verify), then
// assert we land on the set-password form — NOT /dashboard.
async function walk(label, tokenHash, type, nextParam = "/accept-invite", expectHeading = null) {
  await ctx.clearCookies();
  await page.goto(`${BASE}/auth/confirm?token_hash=${tokenHash}&type=${type}&next=${nextParam}`, { waitUntil: "domcontentloaded" });
  await page.click('button:has-text("Continue")');
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  const url = page.url();
  const onAccept = url.includes("/accept-invite");
  // mode-agnostic form detection (the heading text now varies by mode)
  const formVisible = await page.locator("#password").isVisible().catch(() => false);
  const onDashboard = url.includes("/dashboard");
  rec(`${label}: lands on SET-PASSWORD FORM (not /dashboard)`, onAccept && formVisible, onDashboard ? "LANDED ON /dashboard — the bug" : url);
  if (expectHeading) {
    const headingOk = await page.getByText(expectHeading, { exact: true }).first().isVisible().catch(() => false);
    rec(`${label}: heading reads "${expectHeading}"`, headingOk, "");
  }
  if (onAccept && formVisible) {
    await page.fill("#password", NEWPASS);
    await page.fill("#confirm", NEWPASS);
    await page.click('button[type="submit"]'); // mode-agnostic (label varies by mode)
    await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
    rec(`${label}: after setting password → /dashboard`, page.url().includes("/dashboard"), page.url());
  }
}

const inviteEmail = `e2e-invite-${ts}@example.com`;
const recoveryEmail = `e2e-recovery-${ts}@example.com`;
const staleEmail = `e2e-invite-stale-${ts}@example.com`;
try {
  await delUser(inviteEmail);
  await delUser(recoveryEmail);
  await delUser(staleEmail);

  // INVITE: generateLink creates the user + returns the real token_hash
  const inv = await admin.auth.admin.generateLink({
    type: "invite",
    email: inviteEmail,
    options: { data: { role: "team", client_id: null, full_name: "E2E Invite" } },
  });
  if (inv.error) throw new Error(`invite generateLink: ${inv.error.message}`);
  await walk("INVITE", inv.data.properties.hashed_token, "invite", "/accept-invite", "Welcome to 4Pie Labs");

  // RECOVERY: needs an existing user with a password first
  const cu = await admin.auth.admin.createUser({
    email: recoveryEmail, password: INITIAL, email_confirm: true,
    user_metadata: { role: "team", client_id: null, full_name: "E2E Recovery" },
  });
  if (cu.error) throw new Error(`createUser: ${cu.error.message}`);
  const rec_ = await admin.auth.admin.generateLink({ type: "recovery", email: recoveryEmail });
  if (rec_.error) throw new Error(`recovery generateLink: ${rec_.error.message}`);
  await walk("RECOVERY", rec_.data.properties.hashed_token, "recovery", "/accept-invite", "Reset your password");

  // HARDENING PROOF: a STALE invite link carrying next=/dashboard must STILL land on
  // the set-password form (the verifyEmailOtpAction override). Without the hardening
  // this would land on /dashboard — the exact reported symptom.
  const stale = await admin.auth.admin.generateLink({
    type: "invite", email: staleEmail,
    options: { data: { role: "team", client_id: null, full_name: "E2E Stale" } },
  });
  if (stale.error) throw new Error(`stale generateLink: ${stale.error.message}`);
  await walk("INVITE (stale next=/dashboard)", stale.data.properties.hashed_token, "invite", "/dashboard", "Welcome to 4Pie Labs");
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await delUser(inviteEmail);
  await delUser(recoveryEmail);
  await delUser(staleEmail);
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} invite-flow checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("Invite + recovery both reach the set-password form. ✓");
