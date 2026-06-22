// TRACK 2 E2E — staff manage a PROJECT client's KPIs → the client's /results populates,
// with a cost KPI scoring a DROP as a WIN + pacing on track. Self-cleans (temp client +
// users deleted; client delete cascades its defs/entries). Screens → docs/features/results-mgmt/.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const ADMIN = "zz-rm-admin@example.com", CLIENT = "zz-rm-client@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/results-mgmt";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const slug = "zz-rm-" + Math.floor(Math.random() * 1e6);
const P = (m) => `2026-${String(m).padStart(2, "0")}-01`;

async function delUser(email) { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find((x) => x.email === email); if (u) await admin.auth.admin.deleteUser(u.id); }
async function login(page, email, dark = false) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (dark) await page.evaluate(() => localStorage.setItem("rd-mode", "dark"));
  await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let clientId = null;
try {
  await delUser(ADMIN); await delUser(CLIENT);
  await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "RM Admin" } });
  // fresh PROJECT client → guaranteed-empty /results (project clients seed no metrics)
  const { data: c, error: ce } = await admin.from("clients").insert({ name: "ZZ Results Co", slug, client_type: "project", program: "foundation", status: "active", industry: "other_local_service" }).select("id").single();
  if (ce) throw new Error("client insert: " + ce.message);
  clientId = c.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "RM Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "RM Client" }).eq("id", cu.user.id);

  // 1) CLIENT /results BEFORE — empty
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  let page = await ctx.newPage();
  await login(page, CLIENT);
  await page.goto(`${BASE}/results`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/results_before_empty.png`, fullPage: true });
  rec("BEFORE: client /results shows the empty state", await page.locator('text=Your results will appear here').count() > 0);
  await ctx.close();

  // 2) STAFF metrics tab — empty (banner + Start from template), then seed
  ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await login(page, ADMIN);
  await page.goto(`${BASE}/clients/${clientId}/metrics`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  rec("staff sees the Metrics→Results discoverability banner", await page.locator("text=that’s what populates their").count() > 0 || await page.locator("text=Results data").count() > 0);
  await page.screenshot({ path: `${OUT}/staff_metrics_empty.png`, fullPage: true });
  await page.click('button:has-text("Start from a template")');
  await page.waitForTimeout(1800);
  const defCount = await admin.from("metric_definitions").select("id", { count: "exact", head: true }).eq("client_id", clientId).then((r) => r.count ?? 0);
  rec("starter set seeded definitions", defCount >= 5, `${defCount} defs`);
  rec("starter cost KPI is lower_is_better", await admin.from("metric_definitions").select("lower_is_better").eq("client_id", clientId).eq("key", "cost_per_lead").maybeSingle().then((r) => r.data?.lower_is_better === true));
  await page.screenshot({ path: `${OUT}/staff_metrics_seeded.png`, fullPage: true });
  // editor toggle screenshot — open edit on Cost per lead
  const editBtns = page.locator('button[aria-label="Edit"]');
  await editBtns.nth(2).click().catch(() => {});
  await page.waitForSelector(".fui-DialogSurface", { state: "visible", timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  rec("metric editor shows the lower_is_better toggle", await page.locator('.fui-DialogSurface:has-text("Lower is better")').count() > 0);
  await page.screenshot({ path: `${OUT}/staff_editor_toggle.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await ctx.close();

  // 3) staff "enter values + set targets" — write the same columns the staff actions write
  const { data: defs } = await admin.from("metric_definitions").select("id, key").eq("client_id", clientId);
  const byKey = Object.fromEntries((defs ?? []).map((d) => [d.key, d.id]));
  await admin.from("metric_definitions").update({ target: 50 }).eq("id", byKey["cost_per_lead"]);
  await admin.from("metric_definitions").update({ target: 100 }).eq("id", byKey["leads"]);
  const entries = [
    { definition_id: byKey["cost_per_lead"], period: P(1), value_numeric: 80 },
    { definition_id: byKey["cost_per_lead"], period: P(2), value_numeric: 40 }, // DROP → win, 40<=50 on track
    { definition_id: byKey["leads"], period: P(1), value_numeric: 60 },
    { definition_id: byKey["leads"], period: P(2), value_numeric: 90 },         // rise → win
    { definition_id: byKey["conversion_rate"], period: P(1), value_numeric: 3 },
    { definition_id: byKey["conversion_rate"], period: P(2), value_numeric: 5 },
    // website_traffic intentionally UNENTERED → "Awaiting data"
  ].map((e) => ({ ...e, client_id: clientId, value_text: null }));
  const { error: ee } = await admin.from("metric_entries").insert(entries);
  if (ee) throw new Error("entries: " + ee.message);

  // staff entry-status screenshot
  ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  page = await ctx.newPage();
  await login(page, ADMIN);
  await page.goto(`${BASE}/clients/${clientId}/metrics`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/staff_entry_status.png`, fullPage: true });
  rec("staff Entry status panel present", await page.locator("text=Entry status").count() > 0);
  await ctx.close();

  // 4) CLIENT /results AFTER — populated, cost KPI is a win
  for (const dark of [false, true]) {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    page = await ctx.newPage();
    await login(page, CLIENT, dark);
    await page.goto(`${BASE}/results`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/results_after_populated_${dark ? "dark" : "light"}.png`, fullPage: true });
    if (!dark) {
      rec("AFTER: /results shows This month's wins", await page.locator("text=This month’s wins").count() > 0);
      rec("AFTER: cost KPI 'Cost per lead' shows as a DOWN win", await page.locator("text=Cost per lead down").count() > 0);
      rec("AFTER: unentered KPI shows 'Awaiting data'", await page.locator("text=Awaiting data").count() > 0);
      rec("AFTER: a pacing 'On track' appears (cost KPI ≤ target)", await page.locator("text=On track").count() > 0);
    }
    await ctx.close();
  }
  rec("no staff-page console errors", errs.length === 0, errs.slice(0, 2).join(" | ").slice(0, 140));
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId); // cascades defs/entries/threads
  await delUser(ADMIN); await delUser(CLIENT);
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
