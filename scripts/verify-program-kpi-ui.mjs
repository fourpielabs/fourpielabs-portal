// P2 metrics UI screenshots. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-program-kpi-ui.mjs   (server on :3000, or VERIFY_BASE)
// Provisions one PROGRAM client + client user per type + a team user assigned to
// all; seeds a few months of metric_entries; captures the STAFF entry grid + the
// CLIENT performance view per program type. Proves Core has no ad columns and the
// grid/view are catalog-driven.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/program/p2";
mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const CASES = [
  { key: "foundation", label: "Core" },
  { key: "pipeline", label: "Pipeline" },
  { key: "operating_system", label: "Operating System" },
  { key: "pulse", label: "Pulse" },
];
const TEAM_EMAIL = "zz-kpiui-team@example.com";

const pad = (n) => String(n).padStart(2, "0");
const periods = () => {
  const now = new Date(), out = [];
  for (let i = 2; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`); }
  return out;
};

const made = []; // { clientId, email }
let teamUid;
async function ensureUser(email, meta) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email);
  if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  return data.user.id;
}

async function provision(c, i) {
  const slug = `zz-kpiui-${c.key.replace(/_/g, "-")}`;
  const email = `zz-kpiui-${c.key.replace(/_/g, "-")}@example.com`;
  await admin.from("clients").delete().eq("slug", slug);
  const { data: cl, error } = await admin.from("clients")
    .insert({ name: `ZZ KPIUI ${c.label}`, slug, industry: "other_local_service", program: c.key, status: "active", client_type: "program" })
    .select("id").single();
  if (error) throw error;
  await ensureUser(email, { role: "client", client_id: cl.id, full_name: `${c.label} Client` });
  await admin.from("client_assignments").insert({ client_id: cl.id, user_id: teamUid });
  made.push({ clientId: cl.id, email, key: c.key });

  // seed a few months of entries so both surfaces render populated
  const { data: defs } = await admin.from("metric_definitions").select("id, key, unit").eq("client_id", cl.id).eq("is_active", true);
  const rows = [];
  for (const p of periods()) {
    for (const d of defs ?? []) {
      if (d.unit === "text") rows.push({ client_id: cl.id, definition_id: d.id, period: p, value_text: `Strong month for ${d.key.replace(/_/g, " ")}` });
      else {
        const base = d.unit === "currency" ? 1500 : 120;
        rows.push({ client_id: cl.id, definition_id: d.id, period: p, value_numeric: base + Math.round(base * 0.4 * (periods().indexOf(p) + 1)) });
      }
    }
  }
  if (rows.length) await admin.from("metric_entries").insert(rows);
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
  return page;
}

try {
  teamUid = await ensureUser(TEAM_EMAIL, { role: "team", full_name: "KPIUI Team" });
  for (let i = 0; i < CASES.length; i++) await provision(CASES[i], i);

  const page = await makePage(1500, 1100);
  const shot = (t) => page.screenshot({ path: `${OUT}/${t}.png`, fullPage: true });

  // STAFF entry grid per program type
  await page.login(TEAM_EMAIL);
  for (const m of made) {
    await page.goto(`${BASE}/clients/${m.clientId}/metrics`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shot(`staff_entry_${m.key}`);
    const t = await page.locator("body").innerText();
    if (m.key === "foundation") {
      rec("[foundation] staff grid has NO Ad Spend column", !/Ad Spend/.test(t), "");
      rec("[foundation] staff grid shows Leads + AEO", /Leads/.test(t) && /AEO Citations/.test(t), "");
    }
    if (m.key === "pipeline") rec("[pipeline] staff grid HAS Ad Spend + Cost per Lead", /Ad Spend/.test(t) && /Cost per Lead/.test(t), "");
    if (m.key === "operating_system") rec("[os] staff grid HAS Revenue Attributed", /Revenue Attributed/.test(t), "");
    if (m.key === "pulse") rec("[pulse] staff grid social (Followers/Views), NO Ad Spend", /Follower Count|Total Views/.test(t) && !/Ad Spend/.test(t), "");
  }

  // CLIENT performance view per program type
  for (const m of made) {
    await page.login(m.email);
    await page.goto(`${BASE}/performance`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shot(`client_view_${m.key}`);
    const t = await page.locator("body").innerText();
    rec(`[${m.key}] client perf view renders`, /Performance/.test(t), "");
    if (m.key === "foundation") rec("[foundation] client view NO ad metrics", !/Ad Spend/.test(t), "");
    if (m.key === "pipeline") rec("[pipeline] client view shows ad metrics", /Ad Spend/.test(t), "");
  }

  await page.ctx.close();
} finally {
  for (const m of made) {
    await admin.from("clients").delete().eq("id", m.clientId);
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list?.users.find((x) => x.email === m.email);
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  { const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 }); const tu = list?.users.find((x) => x.email === TEAM_EMAIL); if (tu) await admin.auth.admin.deleteUser(tu.id); }
  await browser.close();
  const { data: left } = await admin.from("clients").select("id").like("slug", "zz-kpiui-%");
  rec("teardown — all KPI-UI test clients removed", (left?.length ?? 0) === 0, `${left?.length ?? 0} left`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
