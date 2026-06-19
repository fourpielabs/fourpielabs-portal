// R4 AUTH verification — the glass card over the hero on all 3 auth screens; the static
// fallback firing on each of the 3 triggers (mobile / reduced-motion / no-WebGL); AA on
// the card text over the (worst-case bright) backdrop; console clean (ssr:false → no
// "window is not defined" / hydration errors). BASE=http://localhost:3005 node scripts/redesign-r4-auth-verify.mjs
import { chromium, devices } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3005";
const PW = "FourPie!Demo2026";
const CLIENT = "demo-client@example.com";
const OUT = "docs/redesign/r4", DSF = 2;
mkdirSync(OUT, { recursive: true });

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const la = L(a), lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const parseRGB = (s) => { const m = (s.match(/[\d.]+/g) || []).map(Number); return [m[0] || 0, m[1] || 0, m[2] || 0]; };
const px = (png, x, y) => { const xi = Math.max(0, Math.min(png.width - 1, Math.round(x))); const yi = Math.max(0, Math.min(png.height - 1, Math.round(y))); const i = (yi * png.width + xi) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
const aa = [];
async function auditCard(page, label) {
  const handles = await page.$$(".rd-glass");
  for (const h of handles) {
    let box; try { box = await h.boundingBox(); } catch { continue; }
    if (!box || box.width < 6 || box.height < 6) continue;
    const info = await h.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0) && !n.closest('[disabled],[aria-disabled="true"]'));
      const seen = new Set(); const texts = [];
      for (const n of owners) { const cs = getComputedStyle(n); const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize)); if (seen.has(key)) continue; seen.add(key); const er = n.getBoundingClientRect(); texts.push({ color: cs.color, fontSize: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, sample: n.textContent.trim().slice(0, 22), rx: er.left - r.left, ry: er.top - r.top, rw: er.width, rh: er.height }); }
      return { texts: texts.slice(0, 20), w: r.width, h: r.height };
    });
    if (!info.texts.length) continue;
    let png = null; try { png = PNG.sync.read(await h.screenshot()); } catch { continue; }
    const cx = (x) => Math.max(2, Math.min(info.w - 2, x)), cy = (y) => Math.max(2, Math.min(info.h - 2, y));
    for (const t of info.texts) {
      const fg = parseRGB(t.color); const g = 7;
      const ring = [
        [t.rx - g, t.ry + t.rh / 2], [t.rx + t.rw + g, t.ry + t.rh / 2],
        [t.rx + t.rw / 2, t.ry - g], [t.rx + t.rw / 2, t.ry + t.rh + g],
        [t.rx - g, t.ry - g], [t.rx + t.rw + g, t.ry - g],
        [t.rx - g, t.ry + t.rh + g], [t.rx + t.rw + g, t.ry + t.rh + g],
      ].map(([x, y]) => [cx(x) * DSF, cy(y) * DSF]);
      const cand = ring.map(([x, y]) => { const bg = px(png, x, y); return { cr: ratio(fg, bg), bg }; }).sort((a, b) => a.cr - b.cr);
      const worst = cand[2];
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.weight >= 700);
      const threshold = large ? 3.0 : 4.5;
      aa.push({ label, sample: t.sample, fg: t.color, worstBg: `rgb(${worst.bg.join(",")})`, ratio: Math.round(worst.cr * 100) / 100, threshold, pass: worst.cr >= threshold });
    }
  }
}
const checks = [];
const ck = (n, okv, extra = "") => { checks.push({ n, ok: okv, extra }); console.log(`  ${okv ? "✅" : "❌"} ${n}${extra ? " — " + extra : ""}`); };
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, animations: "disabled", timeout: 60000 }).then(() => console.log("  · " + n));
const consoleSink = (p) => { const errs = []; p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", (e) => errs.push(String(e))); return errs; };
const hydrationOrWindow = (errs) => errs.filter((e) => /hydrat|window is not defined|did not match|Text content does not match/i.test(e));

async function main() {
  const b = await chromium.launch();

  console.log("\n— AUTH SCREENS (desktop) + console clean + AA —");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    const errs = consoleSink(p);
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
    await shot(p, "r4-login-desktop");
    await auditCard(p, "login");
    ck("login: console clean (no hydration / 'window is not defined')", hydrationOrWindow(errs).length === 0, hydrationOrWindow(errs).slice(0, 2).join(" | "));
    const loginTxt = (await p.locator("main").innerText()).toLowerCase();
    ck("login: card renders the sign-in form", /sign in/.test(loginTxt) && /password/.test(loginTxt));

    await p.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" }); await p.waitForTimeout(900);
    await shot(p, "r4-reset-request"); await auditCard(p, "forgot-password");
    ck("reset-request: 'Reset your password' copy", /reset your password/.test((await p.locator("main").innerText()).toLowerCase()));

    // welcome + reset (set-password) forms need a session → sign in first, then visit with the mode param
    await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await p.fill('input[type="email"]', CLIENT); await p.fill('input[type="password"]', PW);
    await Promise.all([p.waitForURL("**/dashboard", { timeout: 30000 }), p.click('button[type="submit"]')]);
    await p.waitForTimeout(500);
    await p.goto(`${BASE}/accept-invite?mode=welcome`, { waitUntil: "networkidle" }); await p.waitForTimeout(900);
    await shot(p, "r4-welcome"); await auditCard(p, "welcome");
    ck("welcome: 'Welcome to 4Pie Labs' + create-password form", /welcome to 4pie labs/.test((await p.locator("main").innerText()).toLowerCase()));
    await p.goto(`${BASE}/accept-invite?mode=reset`, { waitUntil: "networkidle" }); await p.waitForTimeout(900);
    await shot(p, "r4-reset-setpw"); await auditCard(p, "reset-setpw");
    ck("reset(set-pw): 'Reset your password' + new-password form", /reset your password/.test((await p.locator("main").innerText()).toLowerCase()));
    await ctx.close();
  }

  console.log("\n— STATIC FALLBACK fires on all 3 triggers (no <canvas>) —");
  // (1) mobile (coarse pointer via device descriptor)
  {
    const ctx = await b.newContext({ ...devices["iPhone 13"] });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
    await shot(p, "r4-fallback-mobile");
    ck("static fallback on MOBILE (coarse pointer) — no canvas", (await p.locator("canvas").count()) === 0);
    ck("static composition present (hero SVG)", (await p.locator("svg").count()) > 0);
    await ctx.close();
  }
  // (2) reduced-motion
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
    await shot(p, "r4-fallback-reduced-motion");
    ck("static fallback on REDUCED-MOTION — no canvas", (await p.locator("canvas").count()) === 0);
    await ctx.close();
  }
  // (3) no-WebGL (getContext('webgl*') → null)
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-ignore
      HTMLCanvasElement.prototype.getContext = function (type, ...a) { return String(type).includes("webgl") ? null : orig.call(this, type, ...a); };
    });
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
    await shot(p, "r4-fallback-no-webgl");
    ck("static fallback on NO-WEBGL — no canvas", (await p.locator("canvas").count()) === 0);
    await ctx.close();
  }

  await b.close();

  const fails = aa.filter((r) => !r.pass);
  let md = `# R4 — auth card over the hero\n\n## AA (card text, worst-case ring-sampled over the backdrop)\nSamples **${aa.length}** · failing **${fails.length}**\n\n| screen | text | fg | worst bg | ratio | need | ok |\n|---|---|---|---|---|---|---|\n`;
  for (const r of aa.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 16)) md += `| ${r.label} | ${r.sample.replace(/\|/g, "/")} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold} | ${r.pass ? "✅" : "❌"} |\n`;
  md += `\n## Checks\n\n| check | ok |\n|---|---|\n`;
  for (const c of checks) md += `| ${c.n}${c.extra ? " — " + c.extra : ""} | ${c.ok ? "✅" : "❌"} |\n`;
  writeFileSync(`${OUT}/r4-auth-results.md`, md);
  console.log(`\nAA: ${aa.length} samples, ${fails.length} fail`);
  fails.slice(0, 10).forEach((f) => console.log(`  ❌ ${f.label} "${f.sample}" ${f.ratio}:1 fg=${f.fg} bg=${f.worstBg}`));
  console.log(`\n=== R4 auth: ${checks.filter((c) => c.ok).length}/${checks.length} checks, AA ${fails.length === 0 ? "all pass" : fails.length + " fail"} ===`);
  process.exit(fails.length || checks.some((c) => !c.ok) ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
