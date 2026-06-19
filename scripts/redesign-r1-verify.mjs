// REDESIGN R1 verification — shells + primitives: screenshots, worst-case AA over the
// glass chrome, reduced-* solid fallback, nav routing, role visibility, console/hydration.
//   BASE=http://localhost:3005 node scripts/redesign-r1-verify.mjs
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const USERS = {
  client: "demo-client@example.com",
  team: "demo-team@example.com",
  admin: "demo-admin@example.com",
};
const OUT = "docs/redesign/r1";
const DSF = 2;
mkdirSync(OUT, { recursive: true });

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const la = L(a), lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const parseRGB = (s) => { const m = (s.match(/[\d.]+/g) || []).map(Number); return [m[0] || 0, m[1] || 0, m[2] || 0]; };
const px = (png, x, y) => {
  const xi = Math.max(0, Math.min(png.width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(png.height - 1, Math.round(y)));
  const i = (yi * png.width + xi) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
};

const aa = [];
async function auditGlass(page, label) {
  const handles = await page.$$(".rd-glass");
  for (let s = 0; s < handles.length; s++) {
    const h = handles[s];
    let box;
    try { box = await h.boundingBox(); } catch { continue; }
    if (!box || box.width < 4 || box.height < 4) continue;
    const info = await h.evaluate((el) => {
      const effBg = (node) => {
        let n = node;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          const m = c.match(/[\d.]+/g);
          if (m) { const a = m.length >= 4 ? parseFloat(m[3]) : 1; if (a > 0) return { color: c, alpha: a }; }
          n = n.parentElement;
        }
        return { color: "rgba(0,0,0,0)", alpha: 0 };
      };
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) =>
        [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0));
      const seen = new Set(); const texts = [];
      for (const n of owners) {
        const cs = getComputedStyle(n);
        const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize));
        if (seen.has(key)) continue; seen.add(key);
        const bg = effBg(n); const er = n.getBoundingClientRect();
        texts.push({ color: cs.color, fontSize: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400,
          sample: n.textContent.trim().slice(0, 24), bg: bg.color, bgAlpha: bg.alpha,
          rx: er.left - r.left, ry: er.top - r.top, rw: er.width, rh: er.height });
      }
      return { texts: texts.slice(0, 14), w: r.width, h: r.height };
    });
    if (!info.texts.length) continue;
    const needs = info.texts.some((t) => t.bgAlpha < 0.95);
    let png = null;
    if (needs) { try { png = PNG.sync.read(await h.screenshot()); } catch {} }
    const cx = (x) => Math.max(2, Math.min(info.w - 2, x)), cy = (y) => Math.max(2, Math.min(info.h - 2, y));
    for (const t of info.texts) {
      const fg = parseRGB(t.color); let min, worst;
      if (t.bgAlpha >= 0.95) { worst = parseRGB(t.bg); min = ratio(fg, worst); }
      else if (png) {
        const g = 5;
        const ring = [[t.rx - g, t.ry + t.rh / 2], [t.rx + t.rw + g, t.ry + t.rh / 2], [t.rx + t.rw / 2, t.ry - g],
          [t.rx + t.rw / 2, t.ry + t.rh + g], [t.rx - g, t.ry - g], [t.rx + t.rw + g, t.ry + t.rh + g]]
          .map(([x, y]) => [cx(x) * DSF, cy(y) * DSF]);
        min = Infinity; for (const [x, y] of ring) { const bg = px(png, x, y); const cr = ratio(fg, bg); if (cr < min) { min = cr; worst = bg; } }
      } else continue;
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.weight >= 700);
      const threshold = large ? 3.0 : 4.5;
      aa.push({ label, sample: t.sample, fg: t.color, worstBg: `rgb(${worst.join(",")})`, ratio: Math.round(min * 100) / 100, threshold, pass: min >= threshold });
    }
  }
}

const consoleMsgs = [];
async function login(page, email) {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 140)}`); });
  page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message.slice(0, 140)}`));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PW);
  await Promise.all([page.waitForURL("**/dashboard", { timeout: 30000 }), page.click('button[type="submit"]')]);
}
const shot = (page, name, fullPage = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: "disabled", timeout: 60000 }).then(() => console.log("  · " + name));
const clickToggle = async (page) => { await page.locator('button[aria-label*="dark"]:visible, button[aria-label*="light"]:visible').first().click(); await page.waitForTimeout(450); };

const routeChecks = [];
async function checkRoute(page, href, expectStaysOff = false) {
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
  // role guards (requireRole) redirect CLIENT-SIDE in this app (pre-existing; RLS is
  // the real enforcement) — wait for that soft redirect before reading the URL.
  if (expectStaysOff) {
    await page.waitForURL("**/dashboard", { timeout: 5000 }).catch(() => {});
  } else {
    await page.waitForTimeout(350);
  }
  const url = new URL(page.url()).pathname;
  const ok = expectStaysOff ? url !== href : url === href || url.startsWith(href);
  routeChecks.push({ href: `${href}${expectStaysOff ? " (client→redirect)" : ""}`, landed: url, ok });
}

async function main() {
  const browser = await chromium.launch();

  // ===== CLIENT shell =====
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, USERS.client);
    await p.waitForTimeout(700);
    console.log("CLIENT");
    await shot(p, "r1-client-1440-light");
    await auditGlass(p, "client-light");
    // program nav present?
    const navText = await p.locator("header nav").first().innerText().catch(() => "");
    routeChecks.push({ href: "program-tabs(client)", landed: navText.replace(/\n/g, ","), ok: /Program/.test(navText) && /Performance/.test(navText) });
    // nav routing smoke
    for (const h of ["/messages", "/program", "/performance", "/deliverables", "/tasks", "/calls-notes", "/documents", "/dashboard"]) await checkRoute(p, h);
    // role visibility: client must NOT reach staff routes
    await checkRoute(p, "/clients", true);
    await checkRoute(p, "/admin/users", true);
    // dark
    await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(500);
    await clickToggle(p); await shot(p, "r1-client-1440-dark"); await auditGlass(p, "client-dark"); await clickToggle(p);
    // keyboard: focus first nav link, Tab through, check visible focus
    await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(400);
    const kb = await p.evaluate(() => {
      const link = document.querySelector('header nav a'); if (!link) return { focusable: false };
      link.focus();
      const fv = document.activeElement === link;
      const sh = getComputedStyle(link, ":focus-visible").boxShadow;
      return { focusable: fv, hasFocusStyle: !!sh && sh !== "none" };
    });
    routeChecks.push({ href: "keyboard:nav-focusable", landed: JSON.stringify(kb), ok: kb.focusable });
    await ctx.close();
  }

  // ===== CLIENT mobile =====
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, USERS.client); await p.waitForTimeout(700);
    await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(600);
    await shot(p, "r1-client-390");
    // open the More sheet
    const more = p.locator('button[aria-label="More"]');
    if (await more.count()) { await more.first().click(); await p.waitForTimeout(400); await shot(p, "r1-client-390-more"); }
    await ctx.close();
  }

  // ===== CLIENT reduced (solid shell) =====
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await login(p, USERS.client); await p.waitForTimeout(700);
    await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(600);
    await shot(p, "r1-client-reduced-1440");
    await ctx.close();
  }

  // ===== STAFF shell (team — has client switcher) =====
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, USERS.team); await p.waitForTimeout(700);
    console.log("STAFF (team)");
    await shot(p, "r1-staff-1440");
    await auditGlass(p, "staff-light");
    // client switcher open
    const sw = p.locator('button:has-text("Jump to client")');
    if (await sw.count()) { await sw.first().click(); await p.waitForTimeout(400); await shot(p, "r1-staff-switcher"); await p.keyboard.press("Escape"); }
    // collapse
    const collapse = p.locator('button[aria-label="Collapse sidebar"]');
    if (await collapse.count()) { await collapse.first().click(); await p.waitForTimeout(500); await shot(p, "r1-staff-1440-collapsed"); }
    // staff nav routing
    for (const h of ["/clients", "/dashboard"]) await checkRoute(p, h);
    await ctx.close();
  }

  // ===== STAFF mobile drawer =====
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, USERS.team); await p.waitForTimeout(700);
    await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(500);
    const menu = p.locator('button[aria-label="Open menu"]');
    if (await menu.count()) { await menu.first().click(); await p.waitForTimeout(500); await shot(p, "r1-staff-390-drawer"); }
    await ctx.close();
  }

  // ===== ADMIN role visibility =====
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, USERS.admin); await p.waitForTimeout(700);
    const sidebarText = await p.locator("aside").first().innerText().catch(() => "");
    routeChecks.push({ href: "admin-nav(Users+Audit)", landed: sidebarText.replace(/\n/g, ","), ok: /Users/.test(sidebarText) && /Audit/.test(sidebarText) });
    routeChecks.push({ href: "admin-no-switcher", landed: String(/Jump to client/.test(sidebarText)), ok: !/Jump to client/.test(sidebarText) });
    await ctx.close();
  }

  // ===== PRIMITIVE harness (light + dark) =====
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await login(p, USERS.client); await p.waitForTimeout(500);
    await p.goto(`${BASE}/redesign-preview/primitives`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
    console.log("PRIMITIVES");
    await shot(p, "r1-primitives-1440", true);
    await auditGlass(p, "primitives-light");
    await p.locator('button[aria-label*="dark"]').first().click(); await p.waitForTimeout(500);
    await shot(p, "r1-primitives-1440-dark", true);
    await ctx.close();
  }

  await browser.close();

  // ---- report ----
  const aaFail = aa.filter((r) => !r.pass);
  const routeFail = routeChecks.filter((r) => !r.ok);
  let md = `# Redesign R1 — shell verification\n\n`;
  md += `## WCAG AA over glass chrome (worst-case incl. ember bloom)\n\nSamples: **${aa.length}** · failing: **${aaFail.length}**\n\n`;
  md += `| surface | text | fg | worst bg | ratio | need | ok |\n|---|---|---|---|---|---|---|\n`;
  for (const r of aa.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 20))
    md += `| ${r.label} | ${r.sample.replace(/\|/g, "/")} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold}:1 | ${r.pass ? "✅" : "❌"} |\n`;
  md += `\n## Nav routing + role visibility + keyboard\n\nChecks: **${routeChecks.length}** · failing: **${routeFail.length}**\n\n`;
  md += `| check | result | ok |\n|---|---|---|\n`;
  for (const r of routeChecks) md += `| ${r.href} | ${String(r.landed).slice(0, 70)} | ${r.ok ? "✅" : "❌"} |\n`;
  md += `\n## Console\n\nerrors/warnings: ${consoleMsgs.length}; hydration issues: ${consoleMsgs.filter((m) => /hydrat|did not match/i.test(m)).length}\n`;
  for (const m of [...new Set(consoleMsgs)].slice(0, 12)) md += `- ${m}\n`;
  writeFileSync(`${OUT}/r1-results.md`, md);

  console.log(`\nAA: ${aa.length} samples, ${aaFail.length} fail`);
  aaFail.slice(0, 10).forEach((f) => console.log(`  ❌ ${f.label} "${f.sample}" ${f.ratio}:1 need ${f.threshold} bg=${f.worstBg}`));
  console.log(`ROUTES/ROLES/KB: ${routeChecks.length} checks, ${routeFail.length} fail`);
  routeFail.forEach((f) => console.log(`  ❌ ${f.href} → ${f.landed}`));
  console.log(`CONSOLE: ${consoleMsgs.length} msgs, hydration: ${consoleMsgs.filter((m) => /hydrat|did not match/i.test(m)).length}`);
  [...new Set(consoleMsgs)].slice(0, 8).forEach((m) => console.log("  " + m));
}
main().catch((e) => { console.error(e); process.exit(1); });
