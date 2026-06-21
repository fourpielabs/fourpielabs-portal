// BUG 3 sidebar audit. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-sidebar-audit.mjs   (server on :3000)
// Logs in as a temp ADMIN at 1440w and visits EVERY staff/admin route (incl. all
// per-client workspace tabs), asserting the desktop rail <aside> is laid out
// (x≈0, width>200, display≠none) + screenshotting each to docs/fixes/sidebar-audit/.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/sidebar-audit";
mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

async function ensureUser(email, meta) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email);
  if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  return data.user.id;
}

const ADMIN = "zz-sidebar-admin@example.com";
let clientId;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await ensureUser(ADMIN, { role: "admin", full_name: "Sidebar Admin" });
  const SLUG = "zz-sidebar-client";
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ Sidebar", slug: SLUG, industry: "other_local_service", program: "pipeline", status: "active", client_type: "program" }).select("id").single();
  clientId = cl.id;

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", ADMIN);
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);

  const C = `/clients/${clientId}`;
  const routes = [
    ["dashboard", "/dashboard"],
    ["clients", "/clients"],
    ["admin-users", "/admin/users"],
    ["admin-audit", "/admin/audit"],
    ["settings", "/settings"],
    ["client-overview", C],
    ["client-checklist", `${C}/checklist`],
    ["client-program", `${C}/program`],
    ["client-content", `${C}/content`],
    ["client-deliverables", `${C}/deliverables`],
    ["client-metrics", `${C}/metrics`],
    ["client-competitors", `${C}/competitors`],
    ["client-calls", `${C}/calls`],
    ["client-notes", `${C}/notes`],
    ["client-reports", `${C}/reports`],
    ["client-updates", `${C}/updates`],
    ["client-files", `${C}/files`],
    ["client-settings", `${C}/settings`],
    ["client-tasks", `${C}/tasks`],
    ["client-messages", `${C}/messages`],
  ];

  for (const [name, route] of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700); // let the route transition settle (transform → none)
    await page.evaluate(() => window.scrollTo(0, 0)); // some routes (messages) auto-scroll the window
    await page.waitForTimeout(150);
    const rail = await page.evaluate(() => {
      const a = document.querySelector("aside");
      if (!a) return { present: false };
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      // is a rail nav link actually painted on top at its own coordinates? (visual coverage)
      const link = a.querySelector('a[href="/dashboard"], a[href="/clients"]');
      let onTop = null;
      if (link) {
        const lr = link.getBoundingClientRect();
        const el = document.elementFromPoint(lr.x + lr.width / 2, lr.y + lr.height / 2);
        onTop = !!(el && (a === el || a.contains(el)));
      }
      return { present: true, x: Math.round(r.x), width: Math.round(r.width), display: cs.display, onTop };
    });
    const ok = rail.present && rail.x === 0 && rail.width > 200 && rail.display !== "none" && rail.onTop !== false;
    rec(`sidebar @ ${route}`, ok, rail.present ? `x=${rail.x} w=${rail.width} display=${rail.display} onTop=${rail.onTop}` : "NO <aside>");
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  }
  await ctx.close();
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = list?.users.find((x) => x.email === ADMIN);
  if (u) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} routes show the sidebar.`);
if (failed.length) console.log("BROKEN:", failed.map((f) => f.n).join(", "));
process.exit(failed.length ? 1 : 0);
