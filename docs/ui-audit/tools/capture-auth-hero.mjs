// Phase-4 auth-hero verification. Captures the LIVE 3D hero (headed Chrome = real GPU),
// measures fps, samples AA contrast of the frosted form card over the live backdrop, and
// proves the static fallback fires on mobile / reduced-motion / no-WebGL.
//   node docs/ui-audit/tools/capture-auth-hero.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const OUT = "docs/ui-audit/phase-4-auth";
const FB = `${OUT}/fallbacks`;
mkdirSync(OUT, { recursive: true });
mkdirSync(FB, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);

// --- WCAG relative luminance + contrast ---
const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
const TEXT = {
  "dark-ink (labels/heading) #f5f5f3": L(245, 245, 243),
  "dark-ink-2 (sub-text) #a8a8a3": L(168, 168, 163),
  "ink-3 (footer) #8e8b84": L(142, 139, 132),
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server not reachable at " + BASE);
}

await waitForServer();

// ===================== LIVE 3D (headed, real GPU) =====================
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--hide-scrollbars"] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 15000 }).catch(() => {});
  const liveCanvas = !!(await page.$("canvas"));
  await wait(page, 2300); // mount + 700ms crossfade + settle
  await page.screenshot({ path: `${OUT}/login-live.png` });
  console.log("LIVE: canvas mounted on /login:", liveCanvas, "(want true)");

  // cursor-parallax + drift movement proof (two frames)
  await page.mouse.move(1180, 240);
  await wait(page, 140);
  await page.screenshot({ path: `${OUT}/login-drift-a.png` });
  await page.mouse.move(320, 720);
  await wait(page, 700);
  await page.screenshot({ path: `${OUT}/login-drift-b.png` });

  // fps over 2s (rAF proxy — reflects whether the loop keeps up with vsync)
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const loop = (t) => {
          n++;
          t - t0 < 2000 ? requestAnimationFrame(loop) : res(Math.round(n / ((t - t0) / 1000)));
        };
        requestAnimationFrame(loop);
      }),
  );
  console.log("LIVE: fps over 2s (rAF):", fps);

  // tab-hidden pause proof: hide the tab, count frames (should be ~0)
  const hiddenFrames = await page.evaluate(async () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 400));
    let n = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const loop = (t) => {
        n++;
        t - t0 < 800 ? requestAnimationFrame(loop) : res();
      };
      requestAnimationFrame(loop);
    });
    return n; // rAF still ticks, but R3F's frameloop="never" stops GL renders
  });
  console.log("LIVE: rAF ticks while hidden (note: GL renders stop via frameloop):", hiddenFrames);

  // other two auth screens (presentation)
  await page.goto(`${BASE}/accept-invite?mode=welcome`, { waitUntil: "networkidle" });
  await wait(page, 2200);
  await page.screenshot({ path: `${OUT}/accept-invite-welcome.png` });

  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  await wait(page, 2200);
  await page.screenshot({ path: `${OUT}/forgot-password.png` });

  // ---- AA contrast: sample the frosted form-column bg over the LIVE backdrop ----
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await wait(page, 2300);
  const buf = await page.screenshot();
  const dataUrl = "data:image/png;base64," + buf.toString("base64");
  const samples = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((r) => (img.onload = r, (img.src = url)));
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    // empty frosted-bg spots in the form column (card centered, left col ~ x[140,620])
    const pts = [
      [160, 250], [160, 350], [160, 470], [160, 560], [160, 650],
      [300, 250], [430, 250], [300, 650], [600, 400],
    ];
    return pts.map(([x, y]) => {
      const d = g.getImageData(x, y, 1, 1).data;
      return { x, y, r: d[0], g: d[1], b: d[2] };
    });
  }, dataUrl);

  console.log("\n=== AA: sampled frosted form-column background over LIVE 3D ===");
  let worst = -1,
    worstPt = null;
  for (const s of samples) {
    const l = L(s.r, s.g, s.b);
    if (l > worst) {
      worst = l;
      worstPt = s;
    }
  }
  console.log(
    `worst (brightest) bg pixel: rgb(${worstPt.r},${worstPt.g},${worstPt.b}) @ ${worstPt.x},${worstPt.y}  L=${worst.toFixed(4)}`,
  );
  console.log("contrast of each text color vs that worst-case bg (AA normal needs >= 4.5):");
  let pass = true;
  for (const [name, lt] of Object.entries(TEXT)) {
    const cr = contrast(lt, worst);
    const ok = cr >= 4.5;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${cr.toFixed(2)}:1   ${name}`);
  }
  console.log("AA RESULT:", pass ? "ALL FORM TEXT >= 4.5:1 (AA)" : "*** SOME TEXT BELOW AA ***");

  console.log("\nLIVE console errors:", errors.length ? errors : "NONE");
} finally {
  await browser.close();
}

// ===================== FALLBACKS (deterministic, headless) =====================
const b2 = await chromium.launch({ channel: "chrome", headless: true });
try {
  // mobile/touch → coarse pointer → static
  const mctx = await b2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await wait(mp, 1300);
  console.log("\nFALLBACK mobile: canvas present?", !!(await mp.$("canvas")), "(want false → static)");
  await mp.screenshot({ path: `${FB}/mobile.png` });
  await mctx.close();

  // prefers-reduced-motion → static
  const rctx = await b2.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rp = await rctx.newPage();
  await rp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await wait(rp, 1300);
  console.log("FALLBACK reduced-motion: canvas present?", !!(await rp.$("canvas")), "(want false → static)");
  await rp.screenshot({ path: `${FB}/reduced-motion.png` });
  await rctx.close();

  // no-WebGL (null out webgl contexts before any script runs) → static
  const wctx = await b2.newContext({ viewport: { width: 1440, height: 900 } });
  await wctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).startsWith("webgl")) return null;
      return orig.call(this, type, ...rest);
    };
  });
  const wp = await wctx.newPage();
  await wp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await wait(wp, 1300);
  console.log("FALLBACK no-WebGL: canvas present?", !!(await wp.$("canvas")), "(want false → static)");
  await wp.screenshot({ path: `${FB}/no-webgl.png` });
  await wctx.close();
} finally {
  await b2.close();
}
console.log("\ncaptured →", OUT);
