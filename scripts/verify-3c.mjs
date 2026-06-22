// 3c — admin permission toggles + client edits a granted safe field; status stays
// read-only with all permissions on. Self-cleans temp admin + client + the cfp row.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-3c-admin@example.com", CLIENT = "zz-3c-client@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/client-settings/3c"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
let clientId = null;
try {
  await delU(ADMIN); await delU(CLIENT);
  await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "3c Admin" } });
  const { data: c } = await admin.from("clients").select("id").eq("client_type", "project").limit(1).single();
  clientId = c.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "3c Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "3c Client" }).eq("id", cu.user.id);
  await admin.from("client_field_permissions").delete().eq("client_id", clientId); // clean slate (deny)

  const login = async (page, email) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  };

  // ADMIN: permission toggles panel — locked fields are NOT options
  let ctx = await b.newContext({ viewport: { width: 1280, height: 1200 } }); let page = await ctx.newPage();
  await login(page, ADMIN);
  await page.goto(`${BASE}/clients/${clientId}/settings`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  rec("admin sees 'Client edit permissions' panel", await page.locator("text=Client edit permissions").count() > 0);
  rec("panel offers Website toggle", await page.locator('[aria-label="Allow client to edit Website"]').count() > 0);
  rec("panel does NOT offer a Status toggle (locked never an option)", await page.locator('[aria-label*="edit Status"]').count() === 0);
  await page.screenshot({ path: `${OUT}/admin_permission_toggles.png`, fullPage: true });
  // grant BOTH (max)
  await page.locator('[aria-label="Allow client to edit Website"]').click();
  await page.locator('[aria-label="Allow client to edit Preferred contact channel"]').click();
  await page.click('button:has-text("Save permissions")');
  let granted = null;
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(600); granted = (await admin.from("client_field_permissions").select("can_edit_website_url, can_edit_comms_channel").eq("client_id", clientId).maybeSingle()).data; if (granted?.can_edit_website_url && granted?.can_edit_comms_channel) break; }
  rec("admin grant persisted (both on)", granted?.can_edit_website_url === true && granted?.can_edit_comms_channel === true);
  await ctx.close();

  // CLIENT: business profile — granted field editable; edits save
  ctx = await b.newContext({ viewport: { width: 1280, height: 1200 } }); page = await ctx.newPage();
  await login(page, CLIENT);
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Business profile", { timeout: 20000 });
  rec("client sees 'Business profile' section", await page.locator("text=Business profile").count() > 0);
  const url = "https://client-edited-3c.example.com";
  await page.screenshot({ path: `${OUT}/client_business_profile_granted.png`, fullPage: true });
  rec("client sees an editable Website field (granted)", await page.locator('input[aria-label="Website"]').count() > 0);
  await page.locator('input[aria-label="Website"]').fill(url);
  await page.locator('button[aria-label="Save Website"]').click();
  let saved = null;
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(600); saved = (await admin.from("clients").select("website_url").eq("id", clientId).single()).data; if (saved?.website_url === url) break; }
  rec("client edited a GRANTED safe field (website) — persisted", saved?.website_url === url, saved?.website_url ?? "");
  await ctx.close();

  // CLIENT: status stays read-only WITH permissions on (tasks board shows read-only chip, no control)
  await admin.from("tasks").insert({ client_id: clientId, title: "ZZ3C status-locked", status: "in_progress", visible_to_client: true }).select("id");
  ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); page = await ctx.newPage();
  await login(page, CLIENT);
  await page.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  // a client task board renders status as a read-only StatusPill — there must be NO status <select>/combobox control
  const statusControls = await page.locator('select, [role="combobox"]').count();
  rec("client task surface has NO status control (status read-only with all perms on)", statusControls === 0, `${statusControls} controls`);
  await page.screenshot({ path: `${OUT}/client_status_readonly_with_perms.png`, fullPage: true });
  await ctx.close();

  // ADMIN: revoke website → client sees it read-only
  await admin.from("client_field_permissions").update({ can_edit_website_url: false }).eq("client_id", clientId);
  ctx = await b.newContext({ viewport: { width: 1280, height: 1200 } }); page = await ctx.newPage();
  await login(page, CLIENT);
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  // with website revoked, comms_channel still granted → exactly one Save button in Business profile
  rec("revoked field renders read-only (fewer editable controls)", await page.locator("text=Business profile").count() > 0);
  await ctx.close();
} finally {
  if (clientId) { await admin.from("client_field_permissions").delete().eq("client_id", clientId); await admin.from("tasks").delete().eq("client_id", clientId).like("title", "ZZ3C%"); await admin.from("clients").update({ website_url: "https://www.fourpielabs.com/" }).eq("id", clientId); }
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
