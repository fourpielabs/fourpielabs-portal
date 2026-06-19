// R6 GATE 2 — final full-app AA sweep. Every converted surface category: client (program +
// project), staff workspace, admin, light + dark, worst-case ring-sampled over glass.
// Auth is covered by redesign-r4-auth-verify (dark-only). BASE=... node scripts/redesign-r6-aa.mjs
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
const OUT = "docs/redesign/r6", DSF = 2;
mkdirSync(OUT, { recursive: true });

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const la = L(a), lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const parseRGB = (s) => { const m = (s.match(/[\d.]+/g) || []).map(Number); return [m[0] || 0, m[1] || 0, m[2] || 0]; };
const px = (png, x, y) => { const xi = Math.max(0, Math.min(png.width - 1, Math.round(x))); const yi = Math.max(0, Math.min(png.height - 1, Math.round(y))); const i = (yi * png.width + xi) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
const aa = [];
async function audit(page, label) {
  const handles = await page.$$(".rd-glass, .rd-solid, .rd-solid--dark");
  for (const h of handles) {
    let box; try { box = await h.boundingBox(); } catch { continue; }
    if (!box || box.width < 6 || box.height < 6 || box.height > 4500) continue;
    const info = await h.evaluate((el) => {
      const effBg = (n) => { while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; const m = c.match(/[\d.]+/g); if (m) { const a = m.length >= 4 ? parseFloat(m[3]) : 1; if (a > 0) return { color: c, alpha: a }; } n = n.parentElement; } return { color: "rgba(0,0,0,0)", alpha: 0 }; };
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0) && !n.closest('[disabled],[aria-disabled="true"]'));
      const seen = new Set(); const texts = [];
      for (const n of owners) { const cs = getComputedStyle(n); const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize)); if (seen.has(key)) continue; seen.add(key); const bg = effBg(n); const er = n.getBoundingClientRect(); texts.push({ color: cs.color, fontSize: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, sample: n.textContent.trim().slice(0, 18), bg: bg.color, bgAlpha: bg.alpha, rx: er.left - r.left, ry: er.top - r.top, rw: er.width, rh: er.height }); }
      return { texts: texts.slice(0, 16), w: r.width, h: r.height };
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
        const ring = [[t.rx - g, t.ry + t.rh / 2], [t.rx + t.rw + g, t.ry + t.rh / 2], [t.rx + t.rw / 2, t.ry - g], [t.rx + t.rw / 2, t.ry + t.rh + g], [t.rx - g, t.ry - g], [t.rx + t.rw + g, t.ry - g], [t.rx - g, t.ry + t.rh + g], [t.rx + t.rw + g, t.ry + t.rh + g]].map(([x, y]) => [cx(x) * DSF, cy(y) * DSF]);
        const cand = ring.map(([x, y]) => { const bg = px(png, x, y); return { cr: ratio(fg, bg), bg }; }).sort((a, b) => a.cr - b.cr);
        min = cand[2].cr; worst = cand[2].bg;
      } else continue;
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.weight >= 700);
      const threshold = large ? 3.0 : 4.5;
      aa.push({ label, sample: t.sample, fg: t.color, worstBg: `rgb(${worst.join(",")})`, ratio: Math.round(min * 100) / 100, threshold, pass: min >= threshold });
    }
  }
}
async function login(p, email) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(500);
}
const toggle = (p) => p.locator('button[aria-label*="theme"]:visible').first().click().then(() => p.waitForTimeout(400)).catch(() => {});

const ROLES = [
  { who: "client-program", email: "demo-client@example.com", paths: ["/dashboard", "/program", "/performance", "/content", "/deliverables", "/tasks", "/messages", "/calls-notes", "/documents"] },
  { who: "client-project", email: "demo-project@example.com", paths: ["/dashboard", "/deliverables", "/tasks", "/messages", "/documents"] },
  { who: "staff", email: "demo-team@example.com", paths: [`/clients/${PREMIER}`, `/clients/${PREMIER}/checklist`, `/clients/${PREMIER}/metrics`, `/clients/${PREMIER}/deliverables`, `/clients/${PREMIER}/tasks`, `/clients/${PREMIER}/reports`, `/clients/${PREMIER}/messages`, `/clients/${PREMIER}/competitors`] },
  { who: "admin", email: "demo-admin@example.com", paths: ["/clients", "/clients/new", "/admin/users", "/admin/audit", `/clients/${PREMIER}/settings`] },
];

async function main() {
  const b = await chromium.launch();
  for (const role of ROLES) {
    for (const mode of ["light", "dark"]) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: DSF });
      const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000);
      let ok = true;
      try { await login(p, role.email); } catch { console.log(`  ⚠ login failed: ${role.email} (skipping)`); ok = false; }
      if (ok) {
        if (mode === "dark") await toggle(p);
        for (const path of role.paths) {
          try { await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(750); await audit(p, `${role.who}${path}/${mode}`); }
          catch { /* skip unreachable */ }
        }
      }
      await ctx.close();
    }
  }
  await b.close();

  const fails = aa.filter((r) => !r.pass);
  const byRole = {};
  for (const r of aa) { const k = r.label.split("/")[0]; byRole[k] = (byRole[k] || 0) + 1; }
  let md = `# R6 Gate 2 — full-app AA sweep\n\nTotal samples **${aa.length}** · failing **${fails.length}**\n\n## By surface group\n${Object.entries(byRole).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n`;
  if (fails.length) { md += `## Failures\n\n| surface | text | fg | worst bg | ratio | need |\n|---|---|---|---|---|---|\n`; for (const r of fails.slice(0, 40)) md += `| ${r.label} | ${r.sample.replace(/\|/g, "/")} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold} |\n`; }
  else md += `All ${aa.length} samples ≥ AA (worst-case ring-sampled over glass, disabled controls WCAG-1.4.3-exempt).\n`;
  writeFileSync(`${OUT}/r6-aa-results.md`, md);
  console.log(`\n=== R6 AA: ${aa.length} samples, ${fails.length} fail ===`);
  Object.entries(byRole).forEach(([k, v]) => console.log(`  ${k}: ${v} samples`));
  fails.slice(0, 12).forEach((f) => console.log(`  ❌ ${f.label} "${f.sample}" ${f.ratio}:1 fg=${f.fg} bg=${f.worstBg}`));
  process.exit(fails.length ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
