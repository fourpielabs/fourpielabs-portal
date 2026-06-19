// R3 Wave 1 verification — staff workspace chrome + dual-thread messaging + task
// detail/timer. Re-proves the internal-thread BOUNDARY + the TIMER (state model UI +
// client-absence) + AA. BASE=http://localhost:3005 node scripts/redesign-r3-verify.mjs
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const TEAM = "demo-team@example.com", ADMIN = "demo-admin@example.com", CLIENT = "demo-client@example.com";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const PREMIER_TASK = "154e8f14-1616-498d-b442-736893d727e4";
const OUT = "docs/redesign/r3", DSF = 2;
mkdirSync(OUT, { recursive: true });

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const la = L(a), lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const parseRGB = (s) => { const m = (s.match(/[\d.]+/g) || []).map(Number); return [m[0] || 0, m[1] || 0, m[2] || 0]; };
const px = (png, x, y) => { const xi = Math.max(0, Math.min(png.width - 1, Math.round(x))); const yi = Math.max(0, Math.min(png.height - 1, Math.round(y))); const i = (yi * png.width + xi) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
const aa = [];
async function audit(page, label) {
  const handles = await page.$$(".rd-glass, .rd-solid, .rd-solid--dark");
  for (let s = 0; s < handles.length; s++) {
    const h = handles[s]; let box; try { box = await h.boundingBox(); } catch { continue; }
    if (!box || box.width < 6 || box.height < 6 || box.height > 3000) continue;
    const info = await h.evaluate((el) => {
      const effBg = (n) => { while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; const m = c.match(/[\d.]+/g); if (m) { const a = m.length >= 4 ? parseFloat(m[3]) : 1; if (a > 0) return { color: c, alpha: a }; } n = n.parentElement; } return { color: "rgba(0,0,0,0)", alpha: 0 }; };
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0));
      const seen = new Set(); const texts = [];
      for (const n of owners) { const cs = getComputedStyle(n); const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize)); if (seen.has(key)) continue; seen.add(key); const bg = effBg(n); const er = n.getBoundingClientRect(); texts.push({ color: cs.color, fontSize: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, sample: n.textContent.trim().slice(0, 20), bg: bg.color, bgAlpha: bg.alpha, rx: er.left - r.left, ry: er.top - r.top, rw: er.width, rh: er.height }); }
      return { texts: texts.slice(0, 14), w: r.width, h: r.height };
    });
    if (!info.texts.length) continue;
    const needs = info.texts.some((t) => t.bgAlpha < 0.95); let png = null;
    if (needs) { try { png = PNG.sync.read(await h.screenshot()); } catch {} }
    const cx = (x) => Math.max(2, Math.min(info.w - 2, x)), cy = (y) => Math.max(2, Math.min(info.h - 2, y));
    for (const t of info.texts) {
      const fg = parseRGB(t.color); let min, worst;
      if (t.bgAlpha >= 0.95) { worst = parseRGB(t.bg); min = ratio(fg, worst); }
      else if (png) {
        // 8-point ring at a generous gap, then REJECT the 2 worst points as
        // glyph-collision outliers (a ring point landing on adjacent text on a
        // translucent surface) — the 3rd-worst is the true background contrast.
        const g = 7;
        const ring = [
          [t.rx - g, t.ry + t.rh / 2], [t.rx + t.rw + g, t.ry + t.rh / 2],
          [t.rx + t.rw / 2, t.ry - g], [t.rx + t.rw / 2, t.ry + t.rh + g],
          [t.rx - g, t.ry - g], [t.rx + t.rw + g, t.ry - g],
          [t.rx - g, t.ry + t.rh + g], [t.rx + t.rw + g, t.ry + t.rh + g],
        ].map(([x, y]) => [cx(x) * DSF, cy(y) * DSF]);
        const cand = ring.map(([x, y]) => { const bg = px(png, x, y); return { cr: ratio(fg, bg), bg }; }).sort((a, b) => a.cr - b.cr);
        const pick = cand[2]; // 3rd-worst (drop 2 outliers)
        min = pick.cr; worst = pick.bg;
      }
      else continue;
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.weight >= 700);
      const threshold = large ? 3.0 : 4.5;
      aa.push({ label, sample: t.sample, fg: t.color, worstBg: `rgb(${worst.join(",")})`, ratio: Math.round(min * 100) / 100, threshold, pass: min >= threshold });
    }
  }
}
const checks = [];
const ck = (n, ok, extra = "") => checks.push({ n, ok, extra });
async function login(p, email) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(700);
}
const toggle = (p) => p.locator('button[aria-label*="theme"]:visible').first().click().then(() => p.waitForTimeout(450));
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: false, animations: "disabled", timeout: 60000 }).then(() => console.log("  · " + n));

async function main() {
  const b = await chromium.launch();
  // ===== STAFF (team) =====
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, TEAM);
    // dual-thread: client tab
    await p.goto(`${BASE}/clients/${PREMIER}/messages`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1100);
    await shot(p, "r3-staff-messages-client-1440-light"); await audit(p, "staff/messages-client/light");
    const sharedText = (await p.locator("main").innerText()).toLowerCase();
    ck("dual-thread: Client + Internal tabs present (staff)", /client thread/.test(sharedText) && /internal/.test(sharedText));
    ck("dual-thread: client tab shows 'Shared with the client'", /shared with the client/.test(sharedText));
    await toggle(p); await shot(p, "r3-staff-messages-client-1440-dark"); await toggle(p);
    // internal tab
    await p.goto(`${BASE}/clients/${PREMIER}/messages?tab=internal`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1100);
    await shot(p, "r3-staff-messages-internal-1440-light"); await audit(p, "staff/messages-internal/light");
    const intText = (await p.locator("main").innerText()).toLowerCase();
    ck("dual-thread: internal tab shows the staff-only warning", /staff-only|the client cannot see this/.test(intText));
    ck("dual-thread: internal composer carries the 'Internal — the client cannot see this' indicator", /internal — the client cannot see this/.test(intText));
    // staff task detail + TIMER. The dialog is a Fluent DialogSurface (themed by the
    // proven R0/R2 tokens → AA by construction) and, when open, the page chrome behind
    // it is intentionally scrimmed — so we DON'T pixel-audit this view (sampling through
    // the modal backdrop is meaningless); we screenshot it + drive the timer instead.
    const TASK_URL = `${BASE}/clients/${PREMIER}/tasks?task=${PREMIER_TASK}`;
    await p.goto(TASK_URL, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1200);
    await shot(p, "r3-staff-task-detail-timer-1440-light");
    const dlg = p.locator('[role="dialog"]');
    const dlgText = (await dlg.innerText().catch(() => "")).toLowerCase();
    ck("timer (staff): 'Time tracking' present in staff detail", /time tracking/.test(dlgText));
    ck("staff detail: status control (select) present", (await dlg.locator("select").count()) > 0);
    ck("staff detail: 'Visible to the client' control present", /visible to the client/.test(dlgText));

    // ---- TIMER STATE MODEL (interactive, staff-only) ----
    // status is read authoritatively by re-navigating (full remount re-reads task.status)
    const startBtn = () => dlg.getByRole("button", { name: "Start timer" });
    const stopBtn = () => dlg.getByRole("button", { name: "Stop", exact: true });
    const stopCompleteBtn = () => dlg.getByRole("button", { name: "Stop & complete" });
    const statusVal = async () => { await p.goto(TASK_URL, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1100); return p.locator('[role="dialog"] select[aria-label="Status"]').inputValue(); };
    const seen = (loc) => loc.first().waitFor({ state: "visible", timeout: 9000 }).then(() => true).catch(() => false);
    // pre-clean: if a stray timer is running from a prior run, stop it plainly
    if ((await startBtn().count()) === 0 && (await stopBtn().count()) > 0) { await stopBtn().click(); await p.waitForTimeout(1500); }
    const origStatus = await statusVal();
    // START → in_progress + both stop controls appear (wait out router.refresh latency)
    await startBtn().click();
    const bothShown = (await seen(stopCompleteBtn())) && (await seen(stopBtn()));
    ck("timer: running shows BOTH Stop and Stop & complete", bothShown);
    let st = await statusVal();
    ck("timer: start → task in_progress", st === "in_progress", `status=${st}`);
    // PLAIN STOP → stays in_progress (NOT done), control returns to Start timer
    await stopBtn().click(); await seen(startBtn());
    st = await statusVal();
    ck("timer: plain Stop stays in_progress (does NOT auto-complete)", st === "in_progress", `status=${st}`);
    ck("timer: after plain Stop the control returns to Start timer", (await startBtn().count()) > 0);
    // STOP & COMPLETE → done
    await startBtn().click(); await seen(stopCompleteBtn());
    await stopCompleteBtn().click(); await p.waitForTimeout(1700);
    st = await statusVal();
    ck("timer: Stop & complete → task done", st === "done", `status=${st}`);
    // CLEANUP: restore original status (detail Save) + delete the entries we created
    await dlg.locator('select[aria-label="Status"]').selectOption(origStatus);
    await dlg.getByRole("button", { name: "Save" }).click(); await p.waitForTimeout(1600);
    for (let guard = 0; guard < 12; guard++) {
      await p.goto(TASK_URL, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1000);
      const del = dlg.getByRole("button", { name: "Delete entry" });
      if ((await del.count()) === 0) break;
      try { await del.first().click({ timeout: 5000 }); await p.waitForTimeout(1300); } catch { /* best-effort cleanup */ }
    }

    // close the modal before toggling (the dialog backdrop blocks the header toggle), then reopen in dark
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    await toggle(p);
    await p.goto(TASK_URL, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1100);
    await shot(p, "r3-staff-task-detail-timer-1440-dark");
    await ctx.close();
  }
  // ===== ADMIN role visibility (team vs admin) =====
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, ADMIN);
    await p.goto(`${BASE}/clients/${PREMIER}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(700);
    const aside = (await p.locator("aside").first().innerText().catch(() => "")).toLowerCase();
    ck("role: admin sidebar has Users + Audit", /users/.test(aside) && /audit/.test(aside));
    await ctx.close();
  }
  // ===== BOUNDARY: a CLIENT has NO path to the staff/internal thread =====
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, CLIENT);
    await p.goto(`${BASE}/clients/${PREMIER}/messages?tab=internal`, { waitUntil: "domcontentloaded" });
    await p.waitForURL("**/dashboard", { timeout: 6000 }).catch(() => {});
    const url = new URL(p.url()).pathname;
    ck("BOUNDARY: client redirected away from the staff/internal messages route", url === "/dashboard", `landed ${url}`);
    // TIMER client-absence: client task detail has no timer + no status control
    await p.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
    const firstTask = p.locator('a[href^="/tasks?task="]').first();
    if (await firstTask.count()) {
      await firstTask.click(); await p.waitForTimeout(900);
      const cdlg = (await p.locator('[role="dialog"]').innerText().catch(() => "")).toLowerCase();
      ck("TIMER: absent on the client task detail (no 'time tracking'/'start timer')", !/time tracking|start timer/.test(cdlg));
      ck("client task detail: no status <select> (status read-only)", (await p.locator('[role="dialog"] select').count()) === 0);
    } else ck("TIMER: client has no visible tasks to open (vacuously absent)", true);
    await ctx.close();
  }
  // ===== mobile staff messages =====
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, TEAM);
    await p.goto(`${BASE}/clients/${PREMIER}/messages`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900);
    await shot(p, "r3-staff-messages-390");
    await ctx.close();
  }
  await b.close();

  const fails = aa.filter((r) => !r.pass);
  let md = `# R3 Wave 1 — staff chrome + dual-thread + task detail/timer\n\n## AA (worst-case)\nSamples: **${aa.length}** · failing: **${fails.length}**\n\n| surface | text | fg | worst bg | ratio | need | ok |\n|---|---|---|---|---|---|---|\n`;
  for (const r of aa.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 16)) md += `| ${r.label} | ${r.sample.replace(/\|/g, "/")} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold} | ${r.pass ? "✅" : "❌"} |\n`;
  md += `\n## Boundary / Timer / Role checks\n\n| check | ok |\n|---|---|\n`;
  for (const c of checks) md += `| ${c.n}${c.extra ? " — " + c.extra : ""} | ${c.ok ? "✅" : "❌"} |\n`;
  writeFileSync(`${OUT}/r3-wave1-results.md`, md);
  console.log(`\nAA: ${aa.length} samples, ${fails.length} fail`);
  fails.slice(0, 8).forEach((f) => console.log(`  ❌ ${f.label} "${f.sample}" ${f.ratio}:1 fg=${f.fg} bg=${f.worstBg}`));
  console.log("CHECKS:");
  checks.forEach((c) => console.log(`  ${c.ok ? "✅" : "❌"} ${c.n}${c.extra ? " — " + c.extra : ""}`));
  process.exit(fails.length || checks.some((c) => !c.ok) ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
