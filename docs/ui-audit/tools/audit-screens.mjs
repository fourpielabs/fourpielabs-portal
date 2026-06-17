// PHASE-0 AUDIT TOOLING (throwaway — under /docs/ui-audit/ per the audit constraint).
// Full-surface screenshot run for all 3 roles + both client types, @1440 + @390, full-page.
// Output: docs/ui-audit/screens/{role}__{route}__{vp}.png  + a console-error log.
//   Run (server up):  node docs/ui-audit/tools/audit-screens.mjs --base=http://localhost:3000
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = Object.fromEntries(process.argv.slice(2).map((a) => { const s = a.replace(/^--/, ""); const i = s.indexOf("="); return i === -1 ? [s, true] : [s.slice(0, i), s.slice(i + 1)]; }));
const BASE = arg.base || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const OUT = "docs/ui-audit/screens";
mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const idBySlug = async (slug) => (await admin.from("clients").select("id").eq("slug", slug).maybeSingle()).data?.id ?? null;
const PROG = await idBySlug("premier-painting");   // program client
const PROJ = await idBySlug("demo-project");        // demo project client (provisioned)

const VPS = [{ w: 1440, h: 900, tag: "1440" }, { w: 390, h: 844, tag: "390" }];
const slug = (r) => r.replace(/\?.*$/, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";

// Per-role route lists. {P}=program client id, {J}=project client id.
const PUBLIC = ["/login", "/forgot-password", "/accept-invite"];
const ADMIN = [
  "/dashboard", "/settings", "/clients", "/clients/new", "/admin/users", "/admin/audit",
  // program client workspace (canonical staff capture — full tab set incl. admin Settings)
  "/clients/{P}", "/clients/{P}/messages", "/clients/{P}/checklist", "/clients/{P}/program",
  "/clients/{P}/content", "/clients/{P}/metrics", "/clients/{P}/competitors", "/clients/{P}/deliverables",
  "/clients/{P}/tasks", "/clients/{P}/calls", "/clients/{P}/notes", "/clients/{P}/reports",
  "/clients/{P}/updates", "/clients/{P}/files", "/clients/{P}/settings",
  // project client workspace (project-only tab set)
  "/clients/{J}", "/clients/{J}/projects", "/clients/{J}/deliverables", "/clients/{J}/tasks", "/clients/{J}/calls",
];
// team = role-distinct surfaces only (per-client tabs are the SAME components as admin's, minus
// the admin-only Settings tab — captured under admin; documented in README).
const TEAM = ["/dashboard", "/settings", "/clients", "/clients/{P}", "/clients/{J}"];
const CLIENT_PROGRAM = ["/dashboard", "/settings", "/messages", "/program", "/content", "/performance", "/deliverables", "/tasks", "/calls-notes", "/documents"];
const CLIENT_PROJECT = ["/dashboard", "/settings", "/messages", "/deliverables", "/tasks", "/calls-notes", "/documents"];

const ROLES = [
  { role: "public", email: null, routes: PUBLIC },
  { role: "admin", email: "demo-admin@example.com", routes: ADMIN },
  { role: "team", email: "demo-team@example.com", routes: TEAM },
  { role: "client-program", email: "demo-client@example.com", routes: CLIENT_PROGRAM },
  { role: "client-project", email: "demo-project@example.com", routes: CLIENT_PROJECT },
];

const sub = (r) => r.replace("{P}", PROG ?? "_").replace("{J}", PROJ ?? "_");
const errors = [];
const unreachable = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

for (const vp of VPS) {
  for (const { role, email, routes } of ROLES) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(`[${role} ${vp.tag}] ${m.text()}`); });

    if (email) {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.fill("input[type=email]", email);
      await page.fill("input[type=password]", PASS);
      await page.click('button:has-text("Sign in")');
      await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(600);
    }

    for (const rRaw of routes) {
      const r = sub(rRaw);
      const resp = await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => null);
      await page.waitForTimeout(700);
      const landed = new URL(page.url()).pathname;
      const expected = r.replace(/\?.*$/, "");
      if (landed !== expected && !expected.endsWith(landed)) {
        unreachable.push(`[${role} ${vp.tag}] ${r} → redirected to ${landed}`);
      }
      await page.screenshot({ path: `${OUT}/${role}__${slug(rRaw)}__${vp.tag}.png`, fullPage: true }).catch(() => {});
      console.log(`shot ${role} ${r} @${vp.tag}${landed !== expected ? `  (→ ${landed})` : ""}`);
    }
    await ctx.close();
  }
}
await browser.close();

const log = [`# Screenshot run log`, ``, `Program client: ${PROG}`, `Project client: ${PROJ}`, ``,
  `## Redirects / unreachable (${unreachable.length})`, ...unreachable.map((u) => `- ${u}`), ``,
  `## Console errors (${errors.length})`, ...[...new Set(errors)].map((e) => `- ${e}`)].join("\n");
writeFileSync(`${OUT}/_run-log.md`, log);
console.log(`\nDONE. ${unreachable.length} redirects, ${new Set(errors).size} unique console errors. Log: ${OUT}/_run-log.md`);
