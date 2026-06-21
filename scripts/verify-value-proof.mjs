// Value Proof dashboard verification + screenshots. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-value-proof.mjs   (server on :3000)
// Provisions a PROJECT client with KPI data (+target, +cost KPI, +text note) and a
// SECOND project client with NO data; logs in as each client and verifies the
// Results view: wins summary, KPI cards + pacing, no ad cards (none defined), the
// empty state, ZERO time/hours data, and that the client cannot read time_entries.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/value-proof";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const pad = (n) => String(n).padStart(2, "0");
const periods = () => { const now = new Date(), o = []; for (let i = 2; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); o.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`); } return o; };

async function ensureUser(email, meta) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email); if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: meta });
  if (error) throw error; return data.user.id;
}
async function mkProject(slug, name) {
  await admin.from("clients").delete().eq("slug", slug);
  const { data } = await admin.from("clients").insert({ name, slug, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single();
  return data.id;
}

const FULL = "zz-vp-full@example.com", EMPTY = "zz-vp-empty@example.com";
const browser = await chromium.launch({ channel: "chrome", headless: true });
let fullId, emptyId;
try {
  // populated project client — NO ad KPIs defined (proves no empty ad cards)
  fullId = await mkProject("zz-vp-full", "ZZ Value Proof");
  await ensureUser(FULL, { role: "client", client_id: fullId, full_name: "VP Client" });
  const defs = [
    { key: "leads", label: "Leads", unit: "number", target: 100, vals: [60, 80, 95] },
    { key: "gbp_calls", label: "GBP Calls", unit: "number", target: null, vals: [22, 28, 41] },
    { key: "top3_keywords", label: "Top-3 Keywords", unit: "number", target: 20, vals: [8, 12, 15] },
    { key: "organic_traffic", label: "Organic Traffic", unit: "number", target: null, vals: [900, 1100, 1480] },
    { key: "cost_per_lead", label: "Cost per Lead", unit: "currency", target: 50, vals: [70, 60, 48] }, // lower is better
  ];
  let sort = 1;
  for (const d of defs) {
    const { data: def } = await admin.from("metric_definitions").insert({ client_id: fullId, key: d.key, label: d.label, unit: d.unit, sort_order: sort++, is_active: true, target: d.target }).select("id").single();
    const ps = periods();
    for (let i = 0; i < ps.length; i++) await admin.from("metric_entries").insert({ client_id: fullId, definition_id: def.id, period: ps[i], value_numeric: d.vals[i] });
  }
  // a text KPI (qualitative note)
  const { data: kl } = await admin.from("metric_definitions").insert({ client_id: fullId, key: "key_learning", label: "Key Learning", unit: "text", sort_order: sort++, is_active: true }).select("id").single();
  await admin.from("metric_entries").insert({ client_id: fullId, definition_id: kl.id, period: periods()[2], value_text: "Map-pack visibility is compounding — doubling down on review velocity." });

  // empty project client — no metric data
  emptyId = await mkProject("zz-vp-empty", "ZZ Empty Results");
  await ensureUser(EMPTY, { role: "client", client_id: emptyId, full_name: "Empty Client" });

  async function shoot(email, file, w, h, dark = false) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard").catch(() => {});
    if (dark) { await page.evaluate(() => localStorage.setItem("rd-mode", "dark")); }
    await page.goto(`${BASE}/results`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
    const txt = await page.locator("body").innerText();
    await ctx.close();
    return txt;
  }

  const full1440 = await shoot(FULL, "results_populated_1440", 1440, 1100);
  rec("populated: wins summary present", /this month.?s wins/i.test(full1440), "");
  rec("populated: KPI cards present (Leads, Cost per Lead)", /Leads/.test(full1440) && /Cost per Lead/.test(full1440), "");
  rec("populated: target pacing present", /on track|to goal/i.test(full1440), "");
  rec("populated: NO ad cards (none defined)", !/Ad Spend|Ad Conversions/.test(full1440), "");
  rec("populated: ZERO time/hours data", !/time tracking|hours logged|stop & complete|\btimer\b/i.test(full1440), "");
  await shoot(FULL, "results_populated_390", 390, 1300);
  await shoot(FULL, "results_populated_dark_1440", 1440, 1100, true);

  const empty = await shoot(EMPTY, "results_empty", 1440, 900);
  rec("empty: clean empty state", /results will appear here/i.test(empty), "");
  rec("empty: ZERO time/hours data", !/time tracking|hours|timer/i.test(empty), "");

  // client time boundary re-confirm: client cannot read time_entries
  const capi = createClient(url, anonKey, { auth: { persistSession: false } });
  await capi.auth.signInWithPassword({ email: FULL, password: PASS });
  const { data: te } = await capi.from("time_entries").select("id").limit(5);
  rec("client cannot read time_entries (timer boundary intact)", (te?.length ?? 0) === 0, `${te?.length ?? 0} rows`);
} finally {
  for (const id of [fullId, emptyId]) if (id) await admin.from("clients").delete().eq("id", id);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const e of [FULL, EMPTY]) { const u = list?.users.find((x) => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); }
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
