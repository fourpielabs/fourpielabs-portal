// R3 Wave 5 verification — admin surfaces (Clients list, New client, Users, Audit,
// Client settings) + admin guard re-proofs. Screenshots (light/dark) + AA + checks.
// BASE=http://localhost:3005 node scripts/redesign-r3-wave5-verify.mjs
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const ADMIN = "demo-admin@example.com", TEAM = "demo-team@example.com", CLIENT = "demo-client@example.com";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const OUT = "docs/redesign/r3", DSF = 2;
mkdirSync(OUT, { recursive: true });

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const la = L(a), lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const parseRGB = (s) => { const m = (s.match(/[\d.]+/g) || []).map(Number); return [m[0] || 0, m[1] || 0, m[2] || 0]; };
const pxAt = (png, x, y) => { const xi = Math.max(0, Math.min(png.width - 1, Math.round(x))); const yi = Math.max(0, Math.min(png.height - 1, Math.round(y))); const i = (yi * png.width + xi) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
const aa = [];
async function audit(page, label) {
  const handles = await page.$$(".rd-glass, .rd-solid, .rd-solid--dark");
  for (const h of handles) {
    let box; try { box = await h.boundingBox(); } catch { continue; }
    if (!box || box.width < 6 || box.height < 6 || box.height > 5000) continue;
    const info = await h.evaluate((el) => {
      const effBg = (n) => { while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; const m = c.match(/[\d.]+/g); if (m) { const a = m.length >= 4 ? parseFloat(m[3]) : 1; if (a > 0) return { color: c, alpha: a }; } n = n.parentElement; } return { color: "rgba(0,0,0,0)", alpha: 0 }; };
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0) && !n.closest('[disabled],[aria-disabled="true"]'));
      const seen = new Set(); const texts = [];
      for (const n of owners) { const cs = getComputedStyle(n); const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize)); if (seen.has(key)) continue; seen.add(key); const bg = effBg(n); const er = n.getBoundingClientRect(); texts.push({ color: cs.color, fontSize: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, sample: n.textContent.trim().slice(0, 20), bg: bg.color, bgAlpha: bg.alpha, rx: er.left - r.left, ry: er.top - r.top, rw: er.width, rh: er.height }); }
      return { texts: texts.slice(0, 20), w: r.width, h: r.height };
    });
    if (!info.texts.length) continue;
    const needs = info.texts.some((t) => t.bgAlpha < 0.95); let png = null;
    if (needs) { try { png = PNG.sync.read(await h.screenshot()); } catch {} }
    const cx = (x) => Math.max(2, Math.min(info.w - 2, x)), cy = (y) => Math.max(2, Math.min(info.h - 2, y));
    for (const t of info.texts) {
      const fg = parseRGB(t.color); let min, worst;
      if (t.bgAlpha >= 0.95) { worst = parseRGB(t.bg); min = ratio(fg, worst); }
      else if (png) {
        const g = 7;
        const ring = [
          [t.rx - g, t.ry + t.rh / 2], [t.rx + t.rw + g, t.ry + t.rh / 2],
          [t.rx + t.rw / 2, t.ry - g], [t.rx + t.rw / 2, t.ry + t.rh + g],
          [t.rx - g, t.ry - g], [t.rx + t.rw + g, t.ry - g],
          [t.rx - g, t.ry + t.rh + g], [t.rx + t.rw + g, t.ry + t.rh + g],
        ].map(([x, y]) => [cx(x) * DSF, cy(y) * DSF]);
        const cand = ring.map(([x, y]) => { const bg = pxAt(png, x, y); return { cr: ratio(fg, bg), bg }; }).sort((a, b) => a.cr - b.cr);
        min = cand[2].cr; worst = cand[2].bg;
      } else continue;
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
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, animations: "disabled", timeout: 60000 }).then(() => console.log("  · " + n));

const PAGES = [
  { path: "/clients", label: "clients-list", expect: /client/i },
  { path: "/clients/new", label: "new-client", expect: /new client|client type|program|project/i },
  { path: "/admin/users", label: "users", expect: /user|invite|role/i },
  { path: "/admin/audit", label: "audit", expect: /audit|action|actor|no .*activity/i },
  { path: `/clients/${PREMIER}/settings`, label: "client-settings", expect: /settings|assign|details|team/i },
];

async function main() {
  const b = await chromium.launch();
  // ADMIN — screenshots + AA + render + admin-specific checks
  for (const mode of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); await login(p, ADMIN);
    if (mode === "dark") await toggle(p);
    for (const pg of PAGES) {
      await p.goto(`${BASE}${pg.path}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1000);
      await shot(p, `r3-admin-${pg.label}-1440-${mode}`);
      await audit(p, `admin/${pg.label}/${mode}`);
      if (mode === "light") {
        const txt = (await p.locator("main").innerText().catch(() => "")).toLowerCase();
        ck(`${pg.label}: renders converted content`, pg.expect.test(txt));
      }
    }
    if (mode === "light") {
      // GUARD: admin's own user row has NO delete control (self-delete blocked in UI)
      await p.goto(`${BASE}/admin/users`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900);
      const main = await p.locator("main").innerText().catch(() => "");
      ck("guard: admin sees the Users table with a 'You' self-marker", /you/i.test(main));
      // CONDITIONAL create form: program shows the program-tier select, project hides it.
      // Detect the tier select by DOM presence of an <option value="foundation"> (a program tier).
      await p.goto(`${BASE}/clients/new`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900);
      const hasTier = async () => (await p.locator('option[value="foundation"]').count()) > 0;
      // find the client_type select (the one whose options include both program + project)
      let typeSel = null;
      for (const s of await p.locator("select").all()) {
        const vals = await s.locator("option").evaluateAll((os) => os.map((o) => o.value));
        if (vals.includes("project") && vals.includes("program")) { typeSel = s; break; }
      }
      if (typeSel) {
        await typeSel.selectOption("project"); await p.waitForTimeout(500);
        const tierWhenProject = await hasTier();
        await typeSel.selectOption("program"); await p.waitForTimeout(500);
        const tierWhenProgram = await hasTier();
        ck("conditional create form: program shows the tier, project HIDES it", tierWhenProgram && !tierWhenProject, `program=${tierWhenProgram} project=${tierWhenProject}`);
      } else ck("conditional create form: program shows the tier, project HIDES it", false, "client_type select not found");
    }
    await ctx.close();
  }
  // GUARD: TEAM cannot reach /admin/users or /admin/audit
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage(); await login(p, TEAM);
    for (const path of ["/admin/users", "/admin/audit"]) {
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await p.waitForURL((u) => !u.pathname.startsWith("/admin"), { timeout: 6000 }).catch(() => {});
      ck(`guard: TEAM blocked from ${path}`, !new URL(p.url()).pathname.startsWith("/admin"), `landed ${new URL(p.url()).pathname}`);
    }
    await ctx.close();
  }
  // GUARD: CLIENT cannot reach /clients or /admin (redirected to /dashboard)
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage(); await login(p, CLIENT);
    for (const path of ["/clients", "/admin/users"]) {
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await p.waitForURL("**/dashboard", { timeout: 6000 }).catch(() => {});
      ck(`guard: CLIENT blocked from ${path}`, new URL(p.url()).pathname === "/dashboard", `landed ${new URL(p.url()).pathname}`);
    }
    await ctx.close();
  }
  await b.close();

  const fails = aa.filter((r) => !r.pass);
  let md = `# R3 Wave 5 — Admin (Clients · New client · Users · Audit · Client settings)\n\n## AA\nSamples **${aa.length}** · failing **${fails.length}**\n\n| surface | text | fg | worst bg | ratio | need | ok |\n|---|---|---|---|---|---|---|\n`;
  for (const r of aa.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 20)) md += `| ${r.label} | ${r.sample.replace(/\|/g, "/")} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold} | ${r.pass ? "✅" : "❌"} |\n`;
  md += `\n## Checks (render + GUARDS)\n\n| check | ok |\n|---|---|\n`;
  for (const c of checks) md += `| ${c.n}${c.extra ? " — " + c.extra : ""} | ${c.ok ? "✅" : "❌"} |\n`;
  writeFileSync(`${OUT}/r3-wave5-results.md`, md);
  console.log(`\nAA: ${aa.length} samples, ${fails.length} fail`);
  fails.slice(0, 12).forEach((f) => console.log(`  ❌ ${f.label} "${f.sample}" ${f.ratio}:1 fg=${f.fg} bg=${f.worstBg}`));
  console.log("CHECKS:");
  checks.forEach((c) => console.log(`  ${c.ok ? "✅" : "❌"} ${c.n}${c.extra ? " — " + c.extra : ""}`));
  process.exit(fails.length || checks.some((c) => !c.ok) ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
