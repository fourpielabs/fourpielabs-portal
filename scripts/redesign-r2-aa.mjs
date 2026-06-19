// R2 Wave 1 — formal worst-case AA audit over the converted client surfaces (both
// types) + Messages screenshots + message-send functional spot-check.
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const PROGRAM = "demo-client@example.com";
const PROJECT = "demo-project@example.com";
const OUT = "docs/redesign/r2";
const DSF = 2;
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
    const h = handles[s];
    let box; try { box = await h.boundingBox(); } catch { continue; }
    if (!box || box.width < 6 || box.height < 6 || box.height > 3000) continue;
    const info = await h.evaluate((el) => {
      const effBg = (node) => { let n = node; while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; const m = c.match(/[\d.]+/g); if (m) { const a = m.length >= 4 ? parseFloat(m[3]) : 1; if (a > 0) return { color: c, alpha: a }; } n = n.parentElement; } return { color: "rgba(0,0,0,0)", alpha: 0 }; };
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0));
      const seen = new Set(); const texts = [];
      for (const n of owners) { const cs = getComputedStyle(n); const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize)); if (seen.has(key)) continue; seen.add(key); const bg = effBg(n); const er = n.getBoundingClientRect(); texts.push({ color: cs.color, fontSize: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, sample: n.textContent.trim().slice(0, 22), bg: bg.color, bgAlpha: bg.alpha, rx: er.left - r.left, ry: er.top - r.top, rw: er.width, rh: er.height }); }
      return { texts: texts.slice(0, 16), w: r.width, h: r.height };
    });
    if (!info.texts.length) continue;
    const needs = info.texts.some((t) => t.bgAlpha < 0.95);
    let png = null; if (needs) { try { png = PNG.sync.read(await h.screenshot()); } catch {} }
    const cx = (x) => Math.max(2, Math.min(info.w - 2, x)), cy = (y) => Math.max(2, Math.min(info.h - 2, y));
    for (const t of info.texts) {
      const fg = parseRGB(t.color); let min, worst;
      if (t.bgAlpha >= 0.95) { worst = parseRGB(t.bg); min = ratio(fg, worst); }
      else if (png) { const g = 5; const ring = [[t.rx - g, t.ry + t.rh / 2], [t.rx + t.rw + g, t.ry + t.rh / 2], [t.rx + t.rw / 2, t.ry - g], [t.rx + t.rw / 2, t.ry + t.rh + g], [t.rx - g, t.ry - g], [t.rx + t.rw + g, t.ry + t.rh + g]].map(([x, y]) => [cx(x) * DSF, cy(y) * DSF]); min = Infinity; for (const [x, y] of ring) { const bg = px(png, x, y); const cr = ratio(fg, bg); if (cr < min) { min = cr; worst = bg; } } }
      else continue;
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.weight >= 700);
      const threshold = large ? 3.0 : 4.5;
      aa.push({ label, sample: t.sample, fg: t.color, worstBg: `rgb(${worst.join(",")})`, ratio: Math.round(min * 100) / 100, threshold, pass: min >= threshold });
    }
  }
}

const checks = [];
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
  // program: audit each converted surface light + dark
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, PROGRAM);
    const w2 = new Set(["performance", "program", "content", "calls", "documents"]);
    for (const [route, name] of [["/dashboard", "dashboard"], ["/deliverables", "deliverables"], ["/tasks", "tasks"], ["/settings", "settings"], ["/messages", "messages"], ["/performance", "performance"], ["/program", "program"], ["/content", "content"], ["/calls-notes", "calls"], ["/documents", "documents"]]) {
      await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1000);
      await audit(p, `program/${name}/light`);
      if (w2.has(name)) await shot(p, `r2-${name}-1440-light`);
      await toggle(p); await audit(p, `program/${name}/dark`);
      if (w2.has(name)) await shot(p, `r2-${name}-1440-dark`);
      await toggle(p);
    }
    // messages screenshots + send spot-check
    await p.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1000);
    await shot(p, "r2-messages-1440-light");
    await toggle(p); await shot(p, "r2-messages-1440-dark"); await toggle(p);
    const ta = p.locator("textarea").first();
    if (await ta.count()) {
      const msg = "R2 verify ping " + Date.now();
      await ta.fill(msg);
      await p.locator('button:has-text("Send")').first().click();
      await p.waitForTimeout(1200);
      const shown = await p.locator(`text=${msg}`).count();
      checks.push({ n: "messages: send shows the message (optimistic)", ok: shown > 0 });
    }
    // internal boundary: client must NOT see any "Internal — the client cannot see this" banner
    const internalBanner = await p.locator('text=/internal/i').count();
    checks.push({ n: "messages: no internal-thread banner/content for client", ok: internalBanner === 0 });
    await ctx.close();
  }
  // project: audit projects board
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, PROJECT);
    await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900);
    await audit(p, "project/board/light");
    await toggle(p); await audit(p, "project/board/dark"); await toggle(p);
    await ctx.close();
  }
  // mobile messages
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage(); await login(p, PROGRAM);
    await p.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900);
    await shot(p, "r2-messages-390");
    await ctx.close();
  }
  await b.close();

  const fails = aa.filter((r) => !r.pass);
  let md = `# R2 Wave 1 — worst-case AA over converted client surfaces\n\nSamples: **${aa.length}** · failing: **${fails.length}**\n\nTightest 24:\n\n| surface | text | fg | worst bg | ratio | need | ok |\n|---|---|---|---|---|---|---|\n`;
  for (const r of aa.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 24)) md += `| ${r.label} | ${r.sample.replace(/\|/g, "/")} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold} | ${r.pass ? "✅" : "❌"} |\n`;
  writeFileSync(`${OUT}/r2-aa-results.md`, md);
  console.log(`\nAA: ${aa.length} samples, ${fails.length} fail`);
  fails.slice(0, 12).forEach((f) => console.log(`  ❌ ${f.label} "${f.sample}" ${f.ratio}:1 (need ${f.threshold}) fg=${f.fg} bg=${f.worstBg}`));
  console.log("FUNCTIONAL / BOUNDARY:");
  checks.forEach((c) => console.log(`  ${c.ok ? "✅" : "❌"} ${c.n}`));
  process.exit(fails.length || checks.some((c) => !c.ok) ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
