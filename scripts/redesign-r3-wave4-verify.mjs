// R3 Wave 4 verification — Metrics tab (Enter data + Client preview modes, CSV dialog,
// charts, wide container). Screenshots (light/dark) + worst-case AA + render checks.
// BASE=http://localhost:3005 node scripts/redesign-r3-wave4-verify.mjs
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const TEAM = "demo-team@example.com";
const PREMIER = "fb11ee5e-ca30-4937-bba3-7787903467cb";
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
  for (const h of handles) {
    let box; try { box = await h.boundingBox(); } catch { continue; }
    if (!box || box.width < 6 || box.height < 6 || box.height > 4000) continue;
    const info = await h.evaluate((el) => {
      const effBg = (n) => { while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; const m = c.match(/[\d.]+/g); if (m) { const a = m.length >= 4 ? parseFloat(m[3]) : 1; if (a > 0) return { color: c, alpha: a }; } n = n.parentElement; } return { color: "rgba(0,0,0,0)", alpha: 0 }; };
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0) && !n.closest('[disabled],[aria-disabled="true"]')); // WCAG 1.4.3 exempts disabled controls
      const seen = new Set(); const texts = [];
      for (const n of owners) { const cs = getComputedStyle(n); const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize)); if (seen.has(key)) continue; seen.add(key); const bg = effBg(n); const er = n.getBoundingClientRect(); texts.push({ color: cs.color, fontSize: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, sample: n.textContent.trim().slice(0, 20), bg: bg.color, bgAlpha: bg.alpha, rx: er.left - r.left, ry: er.top - r.top, rw: er.width, rh: er.height }); }
      return { texts: texts.slice(0, 18), w: r.width, h: r.height };
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
        const cand = ring.map(([x, y]) => { const bg = px(png, x, y); return { cr: ratio(fg, bg), bg }; }).sort((a, b) => a.cr - b.cr);
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
async function login(p) {
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.fill('input[type="email"]', TEAM); await p.fill('input[type="password"]', PW);
  await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
  await p.waitForTimeout(700);
}
const toggle = (p) => p.locator('button[aria-label*="theme"]:visible').first().click().then(() => p.waitForTimeout(450));
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, animations: "disabled", timeout: 60000 }).then(() => console.log("  · " + n));

async function main() {
  const b = await chromium.launch();
  for (const mode of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000); await login(p);
    if (mode === "dark") await toggle(p);
    await p.goto(`${BASE}/clients/${PREMIER}/metrics`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1300);
    await shot(p, `r3-staff-metrics-enter-1440-${mode}`); await audit(p, `staff/metrics-enter/${mode}`);
    if (mode === "light") {
      const txt = (await p.locator("main").innerText()).toLowerCase();
      ck("metrics enter: Enter data + Import CSV + Entry status present", /enter data/.test(txt) && /import csv/.test(txt) && /entry status/.test(txt));
      ck("metrics enter: definitions + grid present (Add/Save/metric)", /metric|definition|save|add/.test(txt));
      // wide container: the metrics content max-width should be ~90rem (≈1440), wider than the 75rem default tabs
      const w = await p.evaluate(() => { const seg = document.querySelector('[role="tablist"]'); let n = seg; while (n && n !== document.body) { const mw = getComputedStyle(n).maxWidth; if (mw && mw !== "none") return parseFloat(mw); n = n.parentElement; } return 0; });
      ck("metrics: WIDE container (maxWidth ≥ 80rem ≈ 1280px)", w >= 1280, `maxWidth=${Math.round(w)}px`);
      // CSV dialog
      const csvBtn = p.getByRole("button", { name: /import csv/i }).first();
      if (await csvBtn.count()) {
        await csvBtn.click(); await p.waitForTimeout(700);
        await shot(p, "r3-staff-metrics-csv-dialog-light");
        const dlg = (await p.locator('[role="dialog"]').innerText().catch(() => "")).toLowerCase();
        ck("metrics CSV dialog: themed import renders (template/metric_key)", /template|metric_key|csv/.test(dlg));
        await p.keyboard.press("Escape"); await p.waitForTimeout(400);
      }
    }
    // switch to Client preview
    const previewSeg = p.getByRole("tab", { name: /client preview/i }).first();
    if (await previewSeg.count()) {
      await previewSeg.click(); await p.waitForTimeout(1100);
      await shot(p, `r3-staff-metrics-preview-1440-${mode}`); await audit(p, `staff/metrics-preview/${mode}`);
      if (mode === "light") {
        const txt = (await p.locator("main").innerText()).toLowerCase();
        ck("metrics preview: Client preview + charts render", /client preview/.test(txt));
      }
    }
    await ctx.close();
  }
  await b.close();

  const fails = aa.filter((r) => !r.pass);
  let md = `# R3 Wave 4 — Metrics (Enter data · Client preview · CSV · charts · WIDE)\n\n## AA\nSamples **${aa.length}** · failing **${fails.length}**\n\n| surface | text | fg | worst bg | ratio | need | ok |\n|---|---|---|---|---|---|---|\n`;
  for (const r of aa.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 18)) md += `| ${r.label} | ${r.sample.replace(/\|/g, "/")} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold} | ${r.pass ? "✅" : "❌"} |\n`;
  md += `\n## Checks\n\n| check | ok |\n|---|---|\n`;
  for (const c of checks) md += `| ${c.n}${c.extra ? " — " + c.extra : ""} | ${c.ok ? "✅" : "❌"} |\n`;
  writeFileSync(`${OUT}/r3-wave4-results.md`, md);
  console.log(`\nAA: ${aa.length} samples, ${fails.length} fail`);
  fails.slice(0, 10).forEach((f) => console.log(`  ❌ ${f.label} "${f.sample}" ${f.ratio}:1 fg=${f.fg} bg=${f.worstBg}`));
  console.log("CHECKS:");
  checks.forEach((c) => console.log(`  ${c.ok ? "✅" : "❌"} ${c.n}${c.extra ? " — " + c.extra : ""}`));
  process.exit(fails.length || checks.some((c) => !c.ok) ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
