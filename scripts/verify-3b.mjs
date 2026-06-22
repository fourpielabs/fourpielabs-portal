// 3b — team assignment from settings UI: admin assigns/unassigns, audit recorded.
// Self-cleans temp admin + temp team user + any leftover assignment.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-3b-admin@example.com", TEAM = "zz-3b-team@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/client-settings/3b"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
let teamId = null, clientId = null;
try {
  await delU(ADMIN); await delU(TEAM);
  await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "3b Admin" } });
  const { data: tu } = await admin.auth.admin.createUser({ email: TEAM, password: PASS, email_confirm: true, user_metadata: { role: "team", full_name: "ZZ3B Teammate" } });
  teamId = tu.user.id;
  await admin.from("profiles").update({ role: "team", is_active: true, full_name: "ZZ3B Teammate" }).eq("id", teamId);
  const { data: c } = await admin.from("clients").select("id").limit(1).single();
  clientId = c.id;
  await admin.from("client_assignments").delete().eq("client_id", clientId).eq("user_id", teamId); // clean slate

  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", ADMIN); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(`${BASE}/clients/${clientId}/settings`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/assignments_before.png`, fullPage: true });

  // ASSIGN: pick the teammate in the "Add a team member" dropdown, click Assign
  await page.locator('[aria-label="Add a team member"]').click();
  await page.locator(`[role="option"]:has-text("ZZ3B Teammate")`).click().catch(async () => {
    // native select fallback
    await page.locator('select[aria-label="Add a team member"]').selectOption({ label: "ZZ3B Teammate" });
  });
  await page.click('button:has-text("Assign")');
  await page.waitForTimeout(1500);
  const assigned = await admin.from("client_assignments").select("user_id, assigned_by").eq("client_id", clientId).eq("user_id", teamId).maybeSingle();
  rec("assign: client_assignments row created", !!assigned.data, assigned.data ? `assigned_by set=${!!assigned.data.assigned_by}` : "missing");
  const auditA = await admin.from("audit_log").select("id, actor_id, metadata, created_at").eq("action", "assignment.created").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  rec("assign: audit row (assignment.created) with actor + timestamp", !!auditA.data && !!auditA.data.actor_id && !!auditA.data.created_at);
  await page.screenshot({ path: `${OUT}/assignments_after_assigned.png`, fullPage: true });

  // assigned team member can now READ the client (is_assigned scoping) — quick check via their session
  {
    const t = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await t.auth.signInWithPassword({ email: TEAM, password: PASS });
    const r = await t.from("clients").select("id").eq("id", clientId);
    rec("assigned team member can now read the client (is_assigned)", (r.data?.length ?? 0) === 1, `${r.data?.length ?? 0} rows`);
  }

  // UNASSIGN: Remove (opens BaseModal confirm) → Remove
  await page.locator('button:has-text("Remove")').first().click();
  await page.waitForSelector('.fui-DialogSurface', { state: "visible", timeout: 8000 });
  await page.locator('.fui-DialogSurface button:has-text("Remove")').click();
  await page.waitForTimeout(1500);
  const stillThere = await admin.from("client_assignments").select("user_id").eq("client_id", clientId).eq("user_id", teamId).maybeSingle();
  rec("unassign: client_assignments row removed", !stillThere.data);
  const auditR = await admin.from("audit_log").select("id").eq("action", "assignment.removed").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  rec("unassign: audit row (assignment.removed)", !!auditR.data);
  // unassigned team member loses access
  {
    const t = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await t.auth.signInWithPassword({ email: TEAM, password: PASS });
    const r = await t.from("clients").select("id").eq("id", clientId);
    rec("unassigned team member can no longer read the client", (r.data?.length ?? 0) === 0, `${r.data?.length ?? 0} rows`);
  }
  await ctx.close();
} finally {
  if (clientId && teamId) await admin.from("client_assignments").delete().eq("client_id", clientId).eq("user_id", teamId);
  await delU(ADMIN); await delU(TEAM);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
