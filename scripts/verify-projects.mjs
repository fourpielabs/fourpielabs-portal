// Dev-only E2E verification for the Onboarding + Projects phase. Never ships.
//   node scripts/verify-projects.mjs
// Drives the REAL app (production server on :3000) + cross-checks the DB.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, svc, { auth: { persistSession: false } });

const ts = process.env.VERIFY_TS || `${Math.floor(Date.now() / 1000)}`;
const results = [];
const rec = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
};

mkdirSync("screenshots/verify-projects", { recursive: true });
const shot = (page, tag) =>
  page.screenshot({ path: `screenshots/verify-projects/${tag}.png`, fullPage: true });

async function findUserByEmail(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.find((u) => u.email === email) ?? null;
}
async function countRows(table, clientId) {
  const { count } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  return count ?? 0;
}

// ---- selectors for the shadcn/Radix Select fields by their <label> ----------
async function pickSelect(page, labelText, optionText) {
  const trigger = page.locator(
    `div.space-y-2:has(label:has-text("${labelText}")) button[role="combobox"]`,
  );
  await trigger.click();
  await page.locator(`[role="option"]:has-text("${optionText}")`).first().click();
}

const provEmail = `verify-prov-${ts}@example.com`;
const provSlug = `verify-prov-${ts}`;
const boardSlug = `verify-board-${ts}`;
const boardEmail = `verify-board-${ts}@example.com`;
let boardClientId = null;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

async function login(email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(900);
}
async function logout() {
  // /auth/signout is POST-only; clearing the auth cookies is the reliable reset.
  await ctx.clearCookies();
  await page.waitForTimeout(200);
}

try {
  // idempotency: clear any prior verify-* fixtures (clients + their users)
  {
    await admin.from("clients").delete().like("slug", "verify-%");
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) {
      if (u.email?.startsWith("verify-")) await admin.auth.admin.deleteUser(u.id);
    }
  }

  // ========================================================================
  // PHASE 1 — Provisioning a PROJECT client WITH an email (real form/action)
  // ========================================================================
  await login("demo-admin@example.com");
  await page.goto(`${BASE}/clients/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.fill("#name", `Verify Prov ${ts}`);
  await page.fill("#slug", provSlug); // override auto-slug to a deterministic value
  await pickSelect(page, "Client type", "Project");
  await page.fill("#client_full_name", "Prov Client");
  await page.fill("#client_email", provEmail);
  await shot(page, "1_create_form");
  await page.click('button:has-text("Create client")');
  // success navigates to /clients/{id}/settings
  await page.waitForURL("**/clients/**/settings", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, "2_after_create");

  const { data: provClient } = await admin
    .from("clients")
    .select("id, client_type")
    .eq("slug", provSlug)
    .maybeSingle();
  rec("provisioning: client row created", !!provClient, provClient ? provClient.id : "missing");
  rec(
    "provisioning: client_type = 'project'",
    provClient?.client_type === "project",
    provClient?.client_type ?? "n/a",
  );
  if (provClient) {
    const ck = await countRows("checklist_items", provClient.id);
    const ms = await countRows("milestones", provClient.id);
    const md = await countRows("metric_definitions", provClient.id);
    rec("provisioning: NO checklist/roadmap/metrics seeded", ck === 0 && ms === 0 && md === 0, `ck=${ck} ms=${ms} md=${md}`);
  }
  const provUser = await findUserByEmail(provEmail);
  rec(
    "provisioning: welcome/invite fired (pending auth user)",
    !!provUser && !provUser.email_confirmed_at,
    provUser ? (provUser.email_confirmed_at ? "already confirmed?!" : "pending") : "no user — email path did NOT fire",
  );
  // the client user's profile is wired to the new client as role=client
  if (provUser && provClient) {
    const { data: prof } = await admin
      .from("profiles")
      .select("role, client_id")
      .eq("id", provUser.id)
      .maybeSingle();
    rec(
      "provisioning: client profile wired (role=client, own client_id)",
      prof?.role === "client" && prof?.client_id === provClient.id,
      `${prof?.role}/${prof?.client_id === provClient.id ? "own" : "WRONG"}`,
    );
  }
  await logout();

  // ========================================================================
  // PHASE 2 — Project-client UI (board, hidden tabs, redirect, create/edit)
  // Sign-in needs a password, so provision a board user directly (admin).
  // ========================================================================
  await admin.from("clients").delete().eq("slug", boardSlug);
  const { data: boardClient } = await admin
    .from("clients")
    .insert({ name: `Verify Board ${ts}`, slug: boardSlug, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" })
    .select("id")
    .single();
  boardClientId = boardClient.id;
  const existingBoardUser = await findUserByEmail(boardEmail);
  if (existingBoardUser) await admin.auth.admin.deleteUser(existingBoardUser.id);
  await admin.auth.admin.createUser({
    email: boardEmail,
    password: PASS,
    email_confirm: true,
    user_metadata: { role: "client", client_id: boardClientId, full_name: "Board Client" },
  });

  await login(boardEmail);
  await shot(page, "3_project_dashboard");
  const bodyText = await page.locator("body").innerText();
  rec("board: dashboard shows projects board (not roadmap)", /Your projects/i.test(bodyText) && !/90-day/i.test(bodyText), "");
  const programTabs = await page.locator('header nav a:has-text("Program")').count();
  const perfTabs = await page.locator('header nav a:has-text("Performance")').count();
  rec("board: Program + Performance tabs hidden", programTabs === 0 && perfTabs === 0, `program=${programTabs} perf=${perfTabs}`);

  // /performance redirects gracefully to /dashboard
  await page.goto(`${BASE}/performance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  rec("board: /performance redirects to /dashboard", page.url().replace(/\/$/, "").endsWith("/dashboard"), page.url());
  await page.goto(`${BASE}/program`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  rec("board: /program redirects to /dashboard", page.url().replace(/\/$/, "").endsWith("/dashboard"), page.url());

  // add a project via the board → create_project
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.click('button:has-text("Add project")');
  await page.waitForTimeout(400);
  const projTitle = `E2E Website Refresh ${ts}`;
  await page.fill("#p-title", projTitle);
  await page.fill("#p-desc", "Created by the E2E verification run.");
  await page.locator('button:has-text("Add project")').last().click();
  // wait for the dialog to close + the board to refresh with the new card
  await page.waitForSelector(`text=${projTitle}`, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, "4_project_added");
  const appeared = await page.getByText(projTitle).first().isVisible().catch(() => false);
  rec("board: Add project → create_project worked (appears)", appeared, "");
  const { data: createdProj } = await admin
    .from("projects")
    .select("id, status")
    .eq("client_id", boardClientId)
    .eq("title", projTitle)
    .maybeSingle();
  rec("board: project row persisted (status=proposed)", createdProj?.status === "proposed", createdProj?.status ?? "missing");

  // edit status → update_project
  await page.locator('button:has-text("Edit")').first().click();
  await page.waitForTimeout(500);
  await pickSelect(page, "Status", "Active");
  await page.locator('button:has-text("Save")').last().click();
  await page.waitForTimeout(1500);
  await shot(page, "5_project_edited");
  const { data: editedProj } = await admin
    .from("projects")
    .select("status")
    .eq("id", createdProj?.id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  rec("board: Edit status → update_project worked (status=active)", editedProj?.status === "active", editedProj?.status ?? "n/a");
  await logout();

  // ========================================================================
  // PHASE 3 — existing PROGRAM client (Premier) is completely unchanged
  // ========================================================================
  await login("demo-client@example.com");
  await shot(page, "6_program_dashboard");
  const progBody = await page.locator("body").innerText();
  const progNavProgram = await page.locator('header nav a:has-text("Program")').count();
  const progNavPerf = await page.locator('header nav a:has-text("Performance")').count();
  rec("program client: roadmap dashboard intact (90-day present)", /90-day/i.test(progBody), "");
  rec("program client: Program + Performance tabs present", progNavProgram >= 1 && progNavPerf >= 1, `program=${progNavProgram} perf=${progNavPerf}`);
  await logout();
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  // cleanup fixtures
  if (boardClientId) await admin.from("clients").delete().eq("id", boardClientId);
  const bu = await findUserByEmail(boardEmail);
  if (bu) await admin.auth.admin.deleteUser(bu.id);
  await ctx.close();
  await browser.close();
}

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
if (consoleErrors.length) console.log(`\nconsole errors:\n${consoleErrors.slice(0, 10).join("\n")}`);
const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
console.log("All E2E checks passed. ✓");
console.log(`\nNOTE: provisioning fixture left in place for inspection: client slug=${provSlug}, user=${provEmail}`);
