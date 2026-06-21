// Intake wizard E2E + screenshots. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-intake-e2e.mjs   (server on :3000)
// Walks the wizard (Web Dev branch end-to-end → submit), captures a second branch
// (AI Automation) to prove conditional logic, the budget ticker, the asset step,
// and the post-submit kickoff. Verifies a real project + a Pending-assets task were
// created, and the to-do shows on the dashboard.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/intake";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const EMAIL = "zz-intake@example.com", SLUG = "zz-intake";
let clientId, kickoffSaved;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ Intake", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single();
  clientId = cl.id;
  { const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 }); const ex = list?.users.find((u) => u.email === EMAIL); if (ex) await admin.auth.admin.deleteUser(ex.id); }
  await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "Intake Client" } });
  // set a kickoff cal link so the post-submit scheduler renders (reset in teardown)
  const { data: cfgRow } = await admin.from("intake_config").select("id, config").eq("is_active", true).single();
  kickoffSaved = cfgRow.config.kickoff?.calLink ?? "";
  await admin.from("intake_config").update({ config: { ...cfgRow.config, kickoff: { ...cfgRow.config.kickoff, calLink: "fourpielabs/kickoff" } } }).eq("id", cfgRow.id);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  const shot = (t) => page.screenshot({ path: `${OUT}/${t}.png`, fullPage: true });
  const next = async () => { await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(500); };
  const body = () => page.locator("body").innerText();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", EMAIL); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard").catch(() => {});
  await page.waitForTimeout(700);

  // dashboard CTA → intake
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  rec("project dashboard shows 'Start a project' CTA", /Start a project/.test(await body()), "");
  await page.goto(`${BASE}/intake`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);

  // STEP 1 — service selection
  await shot("01_service_step");
  rec("step 1: service options render", /Web Development/.test(await body()) && /AI Automation/.test(await body()), "");
  await page.getByRole("button", { name: /Web Development/ }).click();
  await page.fill('input[placeholder*="marketing website"]', "New marketing website");
  await next();

  // STEP 2 — goals
  await page.locator("textarea").first().fill("Replace our outdated site and capture more leads.");
  await next();

  // STEP 3 — WEB branch (conditional)
  const webTxt = await body();
  rec("WEB branch: shows tech/domain/hosting questions", /Tech preference/.test(webTxt) && /domain/i.test(webTxt), "");
  rec("WEB branch: does NOT show AI 'systems' question", !/What systems should connect/.test(webTxt), "");
  await shot("02_web_branch");
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "I can provide access", exact: true }).click();
  await next();

  // STEP 4 — scope + budget ticker
  await page.getByRole("button", { name: /AI features/ }).click();
  await page.waitForTimeout(400);
  const scopeTxt = await body();
  rec("budget ticker shows an estimate range", /Estimated range/.test(scopeTxt) && /\$/.test(scopeTxt) && /confirmed on your call/.test(scopeTxt), "");
  await shot("03_scope_budget");
  await next();

  // STEP 5 — assets (skip upload → triggers Pending-assets task)
  const assetTxt = await body();
  rec("asset step: upload + secure-credentials notice", /Upload/.test(assetTxt) && /Never paste passwords/.test(assetTxt), "");
  await shot("04_assets");
  await next();

  // STEP 6 — review → submit
  await shot("05_review");
  await page.getByRole("button", { name: "Submit project", exact: true }).click();
  // wait for the post-submit success/kickoff screen (create_project + task + audit takes a moment)
  await page.getByText(/your project is in/i).waitFor({ timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const doneTxt = await body();
  rec("submit → success + kickoff scheduling", /project is in/i.test(doneTxt) && /kickoff/i.test(doneTxt), "");
  await shot("06_kickoff");

  // DB: real project + pending-assets task created
  const { data: projs } = await admin.from("projects").select("id, status, title").eq("client_id", clientId);
  rec("real project created (status proposed)", (projs?.length ?? 0) === 1 && projs[0].status === "proposed", `${projs?.length} project(s)`);
  const { data: tasks } = await admin.from("tasks").select("id, title, visible_to_client").eq("client_id", clientId).like("title", "Pending assets%");
  rec("Pending-assets task auto-created + client-visible", (tasks?.length ?? 0) === 1 && tasks[0].visible_to_client === true, `${tasks?.length} task(s)`);
  const { data: intake } = await admin.from("project_intakes").select("status, service, project_id").eq("client_id", clientId).eq("status", "submitted");
  rec("intake submitted + linked to the project", (intake?.length ?? 0) === 1 && intake[0].service === "web_dev" && !!intake[0].project_id, `${intake?.length}`);

  // dashboard shows the Pending-assets to-do
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  rec("dashboard shows Pending-assets to-do", /Your to-dos/.test(await body()) && /Pending assets/.test(await body()), "");
  await shot("07_dashboard_pending_assets");

  // SECOND branch — AI Automation (prove conditional logic differs)
  await page.goto(`${BASE}/intake`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await page.getByRole("button", { name: /AI Automation/ }).click();
  await page.fill('input[placeholder*="marketing website"]', "Lead-routing automation");
  await next(); // goals
  await page.locator("textarea").first().fill("Auto-route inbound leads with AI scoring.");
  await next(); // → AI branch
  const aiTxt = await body();
  rec("AI branch: shows 'systems' + data-sensitivity (different from Web)", /What systems should connect/.test(aiTxt) && /Data sensitivity/.test(aiTxt) && !/Tech preference/.test(aiTxt), "");
  await shot("08_ai_branch");

  // mobile
  const mctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await mp.fill("input[type=email]", EMAIL); await mp.fill("input[type=password]", PASS);
  await mp.click('button:has-text("Sign in")'); await mp.waitForURL("**/dashboard").catch(() => {});
  await mp.goto(`${BASE}/intake`, { waitUntil: "networkidle" }); await mp.waitForTimeout(800);
  await mp.screenshot({ path: `${OUT}/09_mobile_390.png`, fullPage: true });
  // (resumes the saved AI draft — proves save-and-resume; assert the wizard chrome renders)
  rec("mobile 390: wizard renders", /Step \d+ of \d+/.test(await mp.locator("body").innerText()), "");
  await mctx.close();
  await ctx.close();
} finally {
  // reset kickoff link
  if (clientId !== undefined) {
    const { data: cfgRow } = await admin.from("intake_config").select("id, config").eq("is_active", true).single();
    if (cfgRow) await admin.from("intake_config").update({ config: { ...cfgRow.config, kickoff: { ...cfgRow.config.kickoff, calLink: kickoffSaved ?? "" } } }).eq("id", cfgRow.id);
    await admin.from("clients").delete().eq("id", clientId); // cascade: projects, tasks, intakes
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = list?.users.find((x) => x.email === EMAIL); if (u) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
