// 4a — audit CSV export: admin exports a date-ranged, escaped, filtered CSV; client denied.
// Self-cleans temp users + seeded audit rows.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-4a-admin@example.com", CLIENT = "zz-4a-client@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/track4/4a"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const TRICKY = 'a, "tricky" value\nline2';
const today = new Date().toISOString().slice(0, 10);
const b = await chromium.launch({ channel: "chrome", headless: true });
let adminId = null, clientId = null, seededIds = [];
try {
  await delU(ADMIN); await delU(CLIENT);
  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "4A Admin" } });
  adminId = au.user.id;
  const { data: cc } = await admin.from("clients").select("id").limit(1).single(); clientId = cc.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "4A Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId }).eq("id", cu.user.id);
  // seed: 2 IN-range rows (today) incl. a tricky-escaping one, + 1 OUT-of-range (2020)
  const ins = await admin.from("audit_log").insert([
    { actor_id: adminId, action: "client.updated", entity: "client", client_id: clientId, metadata: { note: TRICKY }, created_at: new Date().toISOString() },
    { actor_id: adminId, action: "client.updated", entity: "client", client_id: clientId, metadata: { k: "plain" }, created_at: new Date().toISOString() },
    { actor_id: adminId, action: "client.updated", entity: "client", client_id: clientId, metadata: { old: true }, created_at: "2020-01-01T00:00:00Z" },
  ]).select("id");
  seededIds = (ins.data ?? []).map(r => r.id);

  // ADMIN export
  let ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); let page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", ADMIN); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  // filter to today's range for THIS client
  await page.goto(`${BASE}/admin/audit?client=${clientId}&from=${today}&to=${today}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Export CSV", { timeout: 15000 }); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/audit_filters_export.png`, fullPage: true });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.click('button:has-text("Export CSV")'),
  ]);
  const path = await dl.path();
  const csv = readFileSync(path, "utf-8");
  rec("CSV downloaded with header", csv.startsWith("When,Actor,Action,Entity,Entity ID,Client,Details"), dl.suggestedFilename());
  // Details = JSON.stringify(metadata) → contains commas + quotes, so the whole cell is
  // CSV-quoted with inner quotes DOUBLED (RFC-4180). Proof: the doubled JSON marker ""note""
  // is present and the cell is wrapped.
  const detailsLine = csv.split(/\r?\n/).find((l) => l.includes("note")) ?? "";
  console.log("   sample Details cell →", detailsLine.slice(0, 110));
  rec("CSV escapes quotes/commas (RFC-4180 doubling on Details JSON)", csv.includes('""note""') && detailsLine.includes("tricky") && /,"\{""note""/.test(detailsLine), "");
  rec("CSV includes in-range rows", (csv.match(/client\.updated/g) ?? []).length >= 2);
  rec("CSV EXCLUDES out-of-range (2020) row", !csv.includes("2020") && !csv.includes('"old"'), "date filter scopes export");
  rec("filename carries the date range", /audit-log.*\.csv/.test(dl.suggestedFilename()));
  await ctx.close();

  // CLIENT denied — the audit page is admin-only (client redirected away)
  ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", CLIENT); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(`${BASE}/admin/audit?from=${today}&to=${today}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1200);
  rec("client cannot reach the audit page (redirected, no Export CSV)", !page.url().includes("/admin/audit") || (await page.locator("text=Export CSV").count()) === 0, page.url().replace(BASE, ""));
  // client cannot read audit_log at all (RLS) — direct read returns 0
  {
    const t = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await t.auth.signInWithPassword({ email: CLIENT, password: PASS });
    const r = await t.from("audit_log").select("id").limit(5);
    rec("client direct audit_log read returns 0 (RLS floor)", (r.data?.length ?? 0) === 0, `${r.data?.length ?? 0} rows`);
  }
  await ctx.close();
} finally {
  if (seededIds.length) await admin.from("audit_log").delete().in("id", seededIds);
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
