// P1 program-aware UI screenshots. Dev-only; never ships. NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-program-ui.mjs    (server on :3000, or VERIFY_BASE)
// Provisions one PROGRAM client + client user per program type (the mirror trigger
// gives each its client_programs row), logs in, captures the catalog-driven Program
// tab (Core / Pipeline / Operating System / Pulse-only) + the rewritten copy
// surfaces, then tears everything down.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/program/p1";
mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const CASES = [
  { key: "foundation", label: "Core", industry: "painting_contractor" },
  { key: "pipeline", label: "Pipeline", industry: "painting_contractor" },
  { key: "operating_system", label: "Operating System", industry: "other_local_service" },
  { key: "pulse", label: "Pulse", industry: "other_local_service" },
];

const made = []; // { clientId, email }
async function provision(c) {
  const slug = `zz-ui-${c.key.replace(/_/g, "-")}`;
  const email = `zz-ui-${c.key.replace(/_/g, "-")}@example.com`;
  await admin.from("clients").delete().eq("slug", slug);
  const { data: cl, error } = await admin.from("clients")
    .insert({ name: `ZZ ${c.label}`, slug, industry: c.industry, program: c.key, status: "active", client_type: "program",
      service_type: c.key === "pulse" ? "Social-first growth" : "Local SEO + growth", investment: "$2,500/mo",
      best_way_to_reach: "Email or the portal", response_time: "Within 1 business day" })
    .select("id").single();
  if (error) throw error;
  // client user
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email);
  if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { error: uErr } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true,
    user_metadata: { role: "client", client_id: cl.id, full_name: `${c.label} Client` } });
  if (uErr) throw uErr;
  made.push({ clientId: cl.id, email });
  return { clientId: cl.id, email };
}

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
  page.setMode = async (mode) => { await page.evaluate((m) => localStorage.setItem("rd-mode", m), mode); };
  return page;
}

try {
  for (const c of CASES) await provision(c);

  const page = await makePage(1440, 1000);
  const shot = (t) => page.screenshot({ path: `${OUT}/${t}.png`, fullPage: true });

  for (const c of CASES) {
    const m = made.find((_, i) => CASES[i].key === c.key);
    await page.login(m.email);
    await page.goto(`${BASE}/program`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot(`program_${c.key}_1440`);
    const txt = await page.locator("body").innerText();
    rec(`[${c.key}] program tab loaded`, txt.includes("What's included"), "");
    rec(`[${c.key}] shows program name ${c.label}`, txt.includes(c.label), "");
    if (c.key === "pulse") {
      rec("[pulse] clean state — no SEO/Local copy in included", !/Local & technical SEO/.test(txt), "");
      rec("[pulse] shows a social service", /Creative production|Meta \+ YouTube/.test(txt), "");
    }
    if (c.key === "foundation") {
      rec("[foundation] 'Available on Pipeline' availability signal", /Available on Pipeline/.test(txt), "");
    }
  }

  // dark-mode Program tab (Pipeline) — mode-aware proof
  {
    const m = made.find((_, i) => CASES[i].key === "pipeline");
    await page.login(m.email);
    await page.setMode("dark");
    await page.goto(`${BASE}/program`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot("program_pipeline_dark_1440");
  }

  // rewritten copy surfaces (pipeline client): performance / deliverables / content
  {
    const m = made.find((_, i) => CASES[i].key === "pipeline");
    await page.login(m.email);
    for (const [route, file, needle] of [
      ["/performance", "copy_performance", "numbers that grow your business"],
      ["/deliverables", "copy_deliverables", "win you more customers"],
      ["/content", "copy_content", "found and cited"],
    ]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      await shot(file);
      const t = await page.locator("body").innerText();
      rec(`copy ${route}`, t.toLowerCase().includes(needle.toLowerCase()), "");
    }
    // no internal/design-speak leak on Performance
    await page.goto(`${BASE}/performance`, { waitUntil: "networkidle" });
    const pt = await page.locator("body").innerText();
    rec("Performance: no 'Glass stops at the door' leak", !/glass stops at the door/i.test(pt), "");
  }

  // mobile Program tab (Pipeline)
  {
    const mp = await makePage(390, 1200);
    const m = made.find((_, i) => CASES[i].key === "pipeline");
    await mp.login(m.email);
    await mp.goto(`${BASE}/program`, { waitUntil: "networkidle" });
    await mp.waitForTimeout(900);
    await mp.screenshot({ path: `${OUT}/program_pipeline_390.png`, fullPage: true });
    await mp.ctx.close();
  }

  await page.ctx.close();
} finally {
  for (const m of made) {
    await admin.from("clients").delete().eq("id", m.clientId);
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list?.users.find((x) => x.email === m.email);
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  await browser.close();
  const { data: leftover } = await admin.from("clients").select("id").like("slug", "zz-ui-%");
  rec("teardown — all UI test clients removed", (leftover?.length ?? 0) === 0, `${leftover?.length ?? 0} left`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
