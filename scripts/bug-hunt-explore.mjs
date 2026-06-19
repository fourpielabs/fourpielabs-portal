// Bug-hunt MAP/TRIAGE explorer — logs in as each role, visits every route, captures a
// screenshot + console errors + a "blank/broken" signal, and runs targeted checks on the
// known suspects (client task detail controls, shell duplication, modal/layout, native selects).
// READ-ONLY (navigates + screenshots; no writes). BASE=... node scripts/bug-hunt-explore.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const DEMOPROJ = "53865671-de53-477b-a7eb-0ba3925938c8";
const OUT = "docs/fixes/explore";
mkdirSync(OUT, { recursive: true });

const findings = [];
const note = (sev, where, what) => { findings.push({ sev, where, what }); console.log(`  [${sev}] ${where} — ${what}`); };

async function login(p, email) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(500);
}
const HYDRATE = /hydrat|did not match|text content does not match/i;

async function visitAll(ctx, role, routes) {
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000);
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push(String(e)));
  await login(p, role.email);
  for (const r of routes) {
    const before = errs.length;
    let ok = true;
    try { await p.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800); }
    catch { ok = false; }
    const url = new URL(p.url()).pathname;
    const txt = (await p.locator("main, body").first().innerText().catch(() => "")).trim();
    const safe = (role.tag + r.path).replace(/[^\w]+/g, "_");
    await p.screenshot({ path: `${OUT}/${safe}.png`, timeout: 60000 }).catch(() => {});
    const newErrs = errs.slice(before);
    const hyd = newErrs.filter((e) => HYDRATE.test(e));
    if (!ok) note("broken", `${role.tag} ${r.path}`, "navigation failed/timed out");
    else if (txt.length < 40 && !r.redirects) note("broken", `${role.tag} ${r.path}`, `near-empty page (${txt.length} chars) — possible crash/blank`);
    if (hyd.length) note("high", `${role.tag} ${r.path}`, `HYDRATION mismatch: ${hyd[0].slice(0, 90)}`);
    const nonHyd = newErrs.filter((e) => !HYDRATE.test(e) && !/Content-Security-Policy|eval/i.test(e));
    if (nonHyd.length) note("medium", `${role.tag} ${r.path}`, `${nonHyd.length} console error(s): ${nonHyd[0].slice(0, 80)}`);
    if (r.redirects && url !== r.redirects) note("high", `${role.tag} ${r.path}`, `expected redirect → ${r.redirects}, landed ${url}`);
  }
  return p;
}

async function main() {
  const b = await chromium.launch();

  // ---------- CLIENT PROGRAM ----------
  console.log("\n— CLIENT (program) demo-client —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const p = await visitAll(ctx, { tag: "cprog", email: "demo-client@example.com" }, [
      { path: "/dashboard" }, { path: "/program" }, { path: "/performance" }, { path: "/content" },
      { path: "/deliverables" }, { path: "/tasks" }, { path: "/messages" }, { path: "/calls-notes" },
      { path: "/documents" }, { path: "/settings" },
    ]);
    // SUSPECT: client task detail modal — open first task, inspect controls
    await p.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
    const first = p.locator('a[href^="/tasks?task="]').first();
    if (await first.count()) {
      await first.click(); await p.waitForTimeout(900);
      const dlg = p.locator('[role="dialog"]');
      if (await dlg.count()) {
        await p.screenshot({ path: `${OUT}/cprog_task-detail-modal.png` });
        const probe = await dlg.evaluate((el) => {
          const txt = el.innerText.toLowerCase();
          return {
            titleInput: !!el.querySelector('input[type="text"], input:not([type])'),
            textarea: !!el.querySelector("textarea"),
            selects: el.querySelectorAll("select").length,
            saveBtn: /save/i.test(txt),
            timer: /time tracking|start timer/.test(txt),
            visibilityToggle: /visible to the client/.test(txt),
            assignWord: /assignee/.test(txt),
          };
        });
        const stray = [];
        if (probe.selects > 0) stray.push(`${probe.selects} <select> (staff status/assignee leak)`);
        if (probe.timer) stray.push("timer (staff-only)");
        if (probe.visibilityToggle) stray.push("visibility toggle (staff-only)");
        if (stray.length) note("high", "cprog client task detail", `STRAY staff controls: ${stray.join(", ")}`);
        else note("ok", "cprog client task detail", `clean: titleInput=${probe.titleInput} textarea=${probe.textarea} save=${probe.saveBtn} selects=0 timer=no`);
      } else note("medium", "cprog /tasks?task=", "no dialog opened on task click");
    } else note("low", "cprog /tasks", "no tasks to open (can't inspect detail)");
    await ctx.close();
  }

  // ---------- CLIENT PROJECT ----------
  console.log("\n— CLIENT (project) demo-project —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await visitAll(ctx, { tag: "cproj", email: "demo-project@example.com" }, [
      { path: "/dashboard" }, { path: "/deliverables" }, { path: "/tasks" }, { path: "/messages" },
      { path: "/documents" }, { path: "/settings" },
      { path: "/program", redirects: "/dashboard" }, { path: "/performance", redirects: "/dashboard" },
    ]);
    await ctx.close();
  }

  // ---------- STAFF (team) on Premier (program) ----------
  console.log("\n— STAFF (team) demo-team —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const base = `/clients/${PREMIER}`;
    await visitAll(ctx, { tag: "staff", email: "demo-team@example.com" }, [
      { path: "/dashboard" }, { path: base }, { path: `${base}/checklist` }, { path: `${base}/program` },
      { path: `${base}/content` }, { path: `${base}/metrics` }, { path: `${base}/competitors` },
      { path: `${base}/deliverables` }, { path: `${base}/tasks` }, { path: `${base}/calls` },
      { path: `${base}/notes` }, { path: `${base}/reports` }, { path: `${base}/updates` },
      { path: `${base}/files` }, { path: `${base}/messages` },
    ]);
    await ctx.close();
  }

  // ---------- ADMIN on project client (Demo Project Co.) + admin surfaces ----------
  console.log("\n— ADMIN demo-admin (incl. project-client workspace) —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const pj = `/clients/${DEMOPROJ}`;
    await visitAll(ctx, { tag: "admin", email: "demo-admin@example.com" }, [
      { path: "/clients" }, { path: "/clients/new" }, { path: "/admin/users" }, { path: "/admin/audit" },
      { path: `/clients/${PREMIER}/settings` },
      { path: pj }, { path: `${pj}/projects` }, { path: `${pj}/deliverables` }, { path: `${pj}/tasks` },
      { path: `${pj}/calls` }, { path: `${pj}/messages` }, { path: `${pj}/settings` },
    ]);
    await ctx.close();
  }

  await b.close();
  const bySev = (s) => findings.filter((f) => f.sev === s);
  console.log(`\n=== EXPLORE DONE — broken:${bySev("broken").length} high:${bySev("high").length} medium:${bySev("medium").length} low:${bySev("low").length} ok:${bySev("ok").length} ===`);
  writeFileSync(`${OUT}/_explore-findings.json`, JSON.stringify(findings, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
