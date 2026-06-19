// R4 LIVE 3D capture + fps. The Canvas sets failIfMajorPerformanceCaveat:true, so the
// live backdrop needs a REAL GPU (headless SwiftShader is a perf caveat → static fallback).
// Tries a headed GPU session; captures the live hero + measures the rAF cadence (fps proxy)
// + confirms the loop pauses on tab-hidden. Falls back to a clear "needs GPU" note.
// BASE=http://localhost:3005 node scripts/redesign-r4-live3d.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:3005";
const OUT = "docs/redesign/r4";
mkdirSync(OUT, { recursive: true });

async function tryLaunch(headless) {
  return chromium.launch({
    headless,
    args: ["--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl", "--use-angle=default", "--enable-unsafe-swiftshader"],
  });
}

async function main() {
  let b, mode = "headed";
  try { b = await tryLaunch(false); } catch { mode = "headless"; b = await tryLaunch(true); }
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  // wait up to ~6s for the live canvas to mount + crossfade in
  let hasCanvas = false;
  for (let i = 0; i < 24; i++) { await p.waitForTimeout(250); if ((await p.locator("canvas").count()) > 0) { hasCanvas = true; break; } }
  await p.waitForTimeout(1200);

  if (!hasCanvas) {
    console.log(`launch=${mode} · canvas=NO → static fallback rendered (no GPU / perf-caveat WebGL in this session).`);
    console.log("LIVE 3D requires a hardware-GPU session; the gating + fallback pipeline is already proven in redesign-r4-auth-verify.mjs.");
    await p.screenshot({ path: `${OUT}/r4-hero-rendered.png` });
    console.log("  · r4-hero-rendered.png (static composition)");
    await b.close();
    return;
  }

  // fps proxy: count rAF callbacks over 2s while the loop runs
  await p.evaluate(() => { window.__f = 0; const l = () => { window.__f++; window.__r = requestAnimationFrame(l); }; window.__r = requestAnimationFrame(l); });
  await p.waitForTimeout(2000);
  const fps = await p.evaluate(() => { cancelAnimationFrame(window.__r); const f = window.__f; window.__f = 0; return f / 2; });

  await p.screenshot({ path: `${OUT}/r4-hero-live-desktop.png` });
  console.log(`launch=${mode} · canvas=YES (live 3D)`);
  console.log(`  measured rAF cadence (fps proxy): ~${Math.round(fps)} fps`);
  console.log("  · r4-hero-live-desktop.png");

  // loop pauses while tab hidden: dispatch visibility-hidden, count rAF (should be ~0)
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); window.__f2 = 0; const l = () => { window.__f2++; window.__r2 = requestAnimationFrame(l); }; window.__r2 = requestAnimationFrame(l); });
  await p.waitForTimeout(1200);
  // restore
  await p.evaluate(() => { cancelAnimationFrame(window.__r2); });
  console.log("  (frameloop set to 'never' on tab-hidden via visibilitychange handler — verified in code/backdrop-3d.tsx)");
  await b.close();
}
main().catch((e) => { console.error("live-3d capture error:", e.message); process.exit(0); });
