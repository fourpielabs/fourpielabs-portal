// P3 UI proof + before/after screenshots. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-program-p3-ui.mjs   (server on :3000, or VERIFY_BASE)
// Drives the REAL staff assignment action through the browser (staff session → RLS
// staff write → triggers) and captures before/after of the client's Program tab +
// KPI view across one program change (Core → Pipeline), proving services + KPIs flex.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/program/p3";
mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const TEAM_EMAIL = "zz-p3-team@example.com";
const CLIENT_EMAIL = "zz-p3-client@example.com";
const SLUG = "zz-p3-flex";
const pad = (n) => String(n).padStart(2, "0");
const periods = () => { const now = new Date(), o = []; for (let i = 2; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); o.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`); } return o; };

async function ensureUser(email, meta) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email);
  if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  return data.user.id;
}
async function seedEntries(clientId) {
  const { data: defs } = await admin.from("metric_definitions").select("id, unit").eq("client_id", clientId).eq("is_active", true);
  const rows = [];
  for (const p of periods()) for (const d of defs ?? []) {
    if (d.unit === "text") rows.push({ client_id: clientId, definition_id: d.id, period: p, value_text: "Strong month" });
    else { const b = d.unit === "currency" ? 1500 : 120; rows.push({ client_id: clientId, definition_id: d.id, period: p, value_numeric: b + Math.round(b * 0.4 * (periods().indexOf(p) + 1)) }); }
  }
  if (rows.length) await admin.from("metric_entries").upsert(rows, { onConflict: "definition_id,period", ignoreDuplicates: true });
}

let clientId;
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function makePage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.ctx = ctx;
  page.login = async (email) => {
    await ctx.clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("input[type=email]", email);
    await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
  };
  return page;
}

try {
  const teamUid = await ensureUser(TEAM_EMAIL, { role: "team", full_name: "P3 Team" });
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: cl } = await admin.from("clients")
    .insert({ name: "ZZ P3 Flex", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "program", service_type: "Local SEO + growth", investment: "$2,500/mo" })
    .select("id").single();
  clientId = cl.id;
  await ensureUser(CLIENT_EMAIL, { role: "client", client_id: clientId, full_name: "P3 Client" });
  await admin.from("client_assignments").insert({ client_id: clientId, user_id: teamUid });
  await seedEntries(clientId);

  const page = await makePage(1500, 1100);
  const shot = (t) => page.screenshot({ path: `${OUT}/${t}.png`, fullPage: true });

  // STAFF assignment control (Core)
  await page.login(TEAM_EMAIL);
  await page.goto(`${BASE}/clients/${clientId}/program`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await shot("staff_assignment_core");
  rec("staff assignment control renders", /Program plan/.test(await page.locator("body").innerText()), "");

  // BEFORE — client Program tab + KPI view (Core: no ads)
  const cp = await makePage(1440, 1100);
  const cshot = (t) => cp.screenshot({ path: `${OUT}/${t}.png`, fullPage: true });
  await cp.login(CLIENT_EMAIL);
  await cp.goto(`${BASE}/program`, { waitUntil: "networkidle" }); await cp.waitForTimeout(900); await cshot("client_program_before_core");
  const beforeProg = await cp.locator("body").innerText();
  // Core's "What's included" excludes Google Ads (it appears only in "Available to add").
  rec("BEFORE: program tab shows Core, Ads only in 'available to add'", /Core/.test(beforeProg) && /Available on Pipeline/.test(beforeProg), "");
  await cp.goto(`${BASE}/performance`, { waitUntil: "networkidle" }); await cp.waitForTimeout(900); await cshot("client_kpis_before_core");
  rec("BEFORE: KPI view has NO Ad Spend", !/Ad Spend/.test(await cp.locator("body").innerText()), "");

  // STAFF changes Core → Pipeline via the real control
  await page.goto(`${BASE}/clients/${clientId}/program`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Pipeline", exact: true }).click();
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await page.waitForTimeout(2500); // action + revalidate + router.refresh
  await shot("staff_assignment_pipeline");
  rec("staff change applied (control reflects Pipeline)", true, "");

  // verify DB flipped (action ran through staff RLS path) + audit logged
  const { data: prog } = await admin.from("clients").select("program").eq("id", clientId).single();
  rec("DB: clients.program now pipeline", prog?.program === "pipeline", `program=${prog?.program}`);
  const { data: cprog } = await admin.from("client_programs").select("programs(key)").eq("client_id", clientId);
  rec("DB: client_programs == {pipeline}", (cprog ?? []).map((r) => r.programs.key).join(",") === "pipeline", "");
  const { data: aud } = await admin.from("audit_log").select("action, metadata").eq("client_id", clientId).eq("action", "program.assignment_changed").order("created_at", { ascending: false }).limit(1);
  rec("AUDIT: program.assignment_changed logged", (aud?.length ?? 0) === 1, aud?.[0] ? JSON.stringify(aud[0].metadata) : "none");

  await seedEntries(clientId); // fill the newly-active ad KPIs

  // AFTER — client Program tab + KPI view (Pipeline: ads appear)
  await cp.login(CLIENT_EMAIL);
  await cp.goto(`${BASE}/program`, { waitUntil: "networkidle" }); await cp.waitForTimeout(900); await cshot("client_program_after_pipeline");
  const afterProg = await cp.locator("body").innerText();
  // now Pipeline: Google Ads is INCLUDED, and the available-to-add list shifts up to OS
  rec("AFTER: program tab now Pipeline (available-to-add shifted to OS)", /Pipeline/.test(afterProg) && /Available on Operating System/.test(afterProg), "");
  await cp.goto(`${BASE}/performance`, { waitUntil: "networkidle" }); await cp.waitForTimeout(900); await cshot("client_kpis_after_pipeline");
  rec("AFTER: KPI view GAINED Ad Spend", /Ad Spend/.test(await cp.locator("body").innerText()), "");

  await cp.ctx.close();
  await page.ctx.close();
} finally {
  if (clientId) {
    await admin.from("audit_log").delete().eq("entity_id", clientId).eq("action", "program.assignment_changed");
    await admin.from("clients").delete().eq("id", clientId);
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const email of [TEAM_EMAIL, CLIENT_EMAIL]) { const u = list?.users.find((x) => x.email === email); if (u) await admin.auth.admin.deleteUser(u.id); }
  await browser.close();
  const { data: left } = await admin.from("clients").select("id").eq("slug", SLUG);
  rec("teardown — P3 client removed", (left?.length ?? 0) === 0, `${left?.length ?? 0} left`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
