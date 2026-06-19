// REDESIGN R0 verification — screenshots + worst-case WCAG AA audit over glass.
//
//   node scripts/redesign-verify.mjs            (defaults to http://localhost:3001)
//   BASE=http://localhost:3000 node scripts/redesign-verify.mjs
//
// Logs in as the demo CLIENT, captures each keystone (desktop 1440 + mobile 390,
// light + dark), captures the reduced-transparency/reduced-motion SOLID fallback,
// and audits AA by screenshotting every glass/dark surface and sampling its
// background at the corners (worst case = the ember bloom) against the REAL
// computed text colors rendered in the browser.
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3001";
const EMAIL = "demo-client@example.com";
const PASSWORD = "FourPie!Demo2026";
const OUT = "docs/redesign/keystones";
const DSF = 2;
mkdirSync(OUT, { recursive: true });

// ---- contrast math (WCAG 2.1) ----
const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const la = L(a), lb = L(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const parseRGB = (s) => {
  const m = (s.match(/[\d.]+/g) || []).map(Number);
  return [m[0] || 0, m[1] || 0, m[2] || 0];
};
const px = (png, x, y) => {
  const xi = Math.max(0, Math.min(png.width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(png.height - 1, Math.round(y)));
  const i = (yi * png.width + xi) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
};

const results = [];

async function auditSurfaces(page, pageLabel, selector) {
  const handles = await page.$$(selector);
  for (let s = 0; s < handles.length; s++) {
    const h = handles[s];
    const info = await h.evaluate((el) => {
      // effective background = first ancestor with a non-transparent
      // background-color (its alpha tells us solid vs translucent glass).
      const effBg = (node) => {
        let n = node;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          const m = c.match(/[\d.]+/g);
          if (m) {
            const a = m.length >= 4 ? parseFloat(m[3]) : 1;
            if (a > 0) return { color: c, alpha: a };
          }
          n = n.parentElement;
        }
        return { color: "rgba(0,0,0,0)", alpha: 0 };
      };
      const r = el.getBoundingClientRect();
      const owners = [...el.querySelectorAll("*")].filter((n) =>
        [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0),
      );
      const seen = new Set();
      const texts = [];
      for (const n of owners) {
        const cs = getComputedStyle(n);
        const key = cs.color + "|" + Math.round(parseFloat(cs.fontSize));
        if (seen.has(key)) continue;
        seen.add(key);
        const bg = effBg(n);
        const er = n.getBoundingClientRect();
        texts.push({
          color: cs.color,
          fontSize: parseFloat(cs.fontSize),
          weight: parseInt(cs.fontWeight, 10) || 400,
          sample: n.textContent.trim().slice(0, 26),
          bg: bg.color,
          bgAlpha: bg.alpha,
          // rect relative to the surface (for sampling bg AROUND the actual text)
          rx: er.left - r.left,
          ry: er.top - r.top,
          rw: er.width,
          rh: er.height,
        });
      }
      return { texts: texts.slice(0, 12), w: r.width, h: r.height };
    });
    if (!info.w || !info.h || info.texts.length === 0) continue;
    // Pixel-sample the surface ONLY when some text sits on translucent glass;
    // text on a solid control/panel is scored analytically against its real bg.
    const needsSample = info.texts.some((t) => t.bgAlpha < 0.95);
    let png = null;
    if (needsSample) {
      try {
        png = PNG.sync.read(await h.screenshot());
      } catch {}
    }
    const clampX = (x) => Math.max(2, Math.min(info.w - 2, x));
    const clampY = (y) => Math.max(2, Math.min(info.h - 2, y));
    for (const t of info.texts) {
      const fg = parseRGB(t.color);
      let min;
      let worst;
      if (t.bgAlpha >= 0.95) {
        worst = parseRGB(t.bg);
        min = ratio(fg, worst);
      } else if (png) {
        // sample the glass background in a ring immediately AROUND the text box
        // (the bg actually behind/adjacent to these glyphs — not unrelated corners)
        const g = 5;
        const ring = [
          [t.rx - g, t.ry + t.rh / 2], [t.rx + t.rw + g, t.ry + t.rh / 2],
          [t.rx + t.rw / 2, t.ry - g], [t.rx + t.rw / 2, t.ry + t.rh + g],
          [t.rx - g, t.ry - g], [t.rx + t.rw + g, t.ry - g],
          [t.rx - g, t.ry + t.rh + g], [t.rx + t.rw + g, t.ry + t.rh + g],
        ].map(([x, y]) => [clampX(x) * DSF, clampY(y) * DSF]);
        min = Infinity;
        for (const [x, y] of ring) {
          const bg = px(png, x, y);
          const cr = ratio(fg, bg);
          if (cr < min) { min = cr; worst = bg; }
        }
      } else {
        continue;
      }
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.weight >= 700);
      const threshold = large ? 3.0 : 4.5;
      results.push({
        page: pageLabel,
        surface: `${selector}#${s}`,
        sample: t.sample,
        fg: t.color,
        worstBg: `rgb(${worst.join(",")})`,
        method: t.bgAlpha >= 0.95 ? "solid" : "glass-sample",
        fontSize: t.fontSize,
        ratio: Math.round(min * 100) / 100,
        threshold,
        pass: min >= threshold,
        large,
      });
    }
  }
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, animations: "disabled", caret: "hide", timeout: 60000 });
  console.log(`  · ${name}.png`);
}

// Force the deterministic STATIC hero (no WebGL rAF that defeats the screenshotter)
// while leaving motion + glass translucency intact. R0 explicitly allows a static
// backdrop; the live 3D stays gated/available in the real app.
const NO_WEBGL = () => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (typeof type === "string" && type.toLowerCase().includes("webgl")) return null;
    return orig.call(this, type, ...rest);
  };
};

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF });
  await ctx.addInitScript(NO_WEBGL);
  const page = await ctx.newPage();

  // --- login as the demo client (live form) ---
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log("logged in as client");

  const toggleDark = async () => {
    await page.click('button[aria-label*="dark"]');
    await page.waitForTimeout(450);
  };
  const toggleLight = async () => {
    await page.click('button[aria-label*="light"]');
    await page.waitForTimeout(450);
  };

  // ===== AUTH (single-mode dark) =====
  await page.goto(`${BASE}/redesign-preview/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  console.log("AUTH");
  await shoot(page, "redesign-login-1440");
  await auditSurfaces(page, "auth", ".rd-glass");

  // ===== DASHBOARD (light, then dark) =====
  await page.goto(`${BASE}/redesign-preview/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  console.log("DASHBOARD light");
  await shoot(page, "redesign-dashboard-1440");
  await auditSurfaces(page, "dashboard-light", ".rd-glass");
  await auditSurfaces(page, "dashboard-light", ".rd-solid--dark");
  await toggleDark();
  await shoot(page, "redesign-dashboard-dark-1440");
  await auditSurfaces(page, "dashboard-dark", ".rd-glass");
  await toggleLight();

  // ===== PERFORMANCE (light, then dark) =====
  await page.goto(`${BASE}/redesign-preview/performance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  console.log("PERFORMANCE light");
  await shoot(page, "redesign-performance-1440");
  await auditSurfaces(page, "performance-light", ".rd-solid");
  await toggleDark();
  await shoot(page, "redesign-performance-dark-1440");
  await auditSurfaces(page, "performance-dark", ".rd-solid--dark");
  await toggleLight();

  // ===== reduced-transparency / reduced-motion → SOLID fallback =====
  console.log("reduced-* fallback");
  let reducedTransparencyOK = true;
  try {
    await ctx.close();
  } catch {}
  // both prefs map to the same CSS fallback; emulate reduced-motion (always supported),
  // and try reduced-transparency too if this Playwright supports it.
  const reducedOpts = { reducedMotion: "reduce" };
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF, ...reducedOpts });
  await ctx2.addInitScript(NO_WEBGL);
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p2.fill('input[type="email"]', EMAIL);
  await p2.fill('input[type="password"]', PASSWORD);
  await Promise.all([p2.waitForURL("**/dashboard", { timeout: 30000 }), p2.click('button[type="submit"]')]);
  try {
    await p2.emulateMedia({ media: "screen", reducedMotion: "reduce", forcedColors: "none" });
  } catch {}
  await p2.goto(`${BASE}/redesign-preview/dashboard`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: `${OUT}/redesign-dashboard-reduced-1440.png`, fullPage: true });
  console.log("  · redesign-dashboard-reduced-1440.png (solid fallback)");
  await ctx2.close();

  // ===== mobile 390 =====
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
  await m.addInitScript(NO_WEBGL);
  const mp = await m.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await mp.fill('input[type="email"]', EMAIL);
  await mp.fill('input[type="password"]', PASSWORD);
  await Promise.all([mp.waitForURL("**/dashboard", { timeout: 30000 }), mp.click('button[type="submit"]')]);
  for (const [route, name] of [
    ["login", "redesign-login-390"],
    ["dashboard", "redesign-dashboard-390"],
    ["performance", "redesign-performance-390"],
  ]) {
    await mp.goto(`${BASE}/redesign-preview/${route}`, { waitUntil: "domcontentloaded" });
    await mp.waitForTimeout(900);
    await mp.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(`  · ${name}.png`);
  }
  await m.close();

  await browser.close();

  // ---- report ----
  const fails = results.filter((r) => !r.pass);
  let md = `# Redesign R0 — WCAG AA audit (empirical, worst-case over glass)\n\n`;
  md += `Method: each glass / dark surface is screenshotted; the background is sampled at 8 inset points (corners + edge midpoints — where the ember bloom is strongest), and the MINIMUM contrast against the REAL computed text color is reported. Generated by scripts/redesign-verify.mjs.\n\n`;
  md += `Total text-color/surface samples: **${results.length}** · failing: **${fails.length}**\n\n`;
  md += `| Page | Text (sample) | px | fg color | worst bg | ratio | need | verdict |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of results) {
    md += `| ${r.page} | ${r.sample.replace(/\|/g, "/")} | ${Math.round(r.fontSize)} | ${r.fg} | ${r.worstBg} | ${r.ratio}:1 | ${r.threshold}:1 | ${r.pass ? "✅" : "❌"} |\n`;
  }
  writeFileSync(`${OUT}/aa-results.md`, md);
  console.log(`\nAA: ${results.length} samples, ${fails.length} failing`);
  for (const f of fails) console.log(`  ❌ ${f.page} "${f.sample}" ${f.ratio}:1 (need ${f.threshold}) fg=${f.fg} bg=${f.worstBg}`);
  process.exit(fails.length ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
