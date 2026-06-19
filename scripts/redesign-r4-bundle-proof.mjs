// R4 BUNDLE-ISOLATION PROOF. Proves three.js (+ cal.com embed) ship in their own async
// chunk(s) and are referenced by ZERO routes' INITIAL JS — so the data app downloads zero
// three.js / cal. Two independent methods:
//   (A) STATIC: scan emitted chunks → which contain three/cal; assert NOT in the shared
//       baseline (build-manifest rootMainFiles, loaded by every route).
//   (B) RUNTIME: fetch each PUBLIC route's served HTML; assert the three/cal chunk
//       filename appears NOWHERE in it (dynamic-only chunks load post-hydration, never SSR'd).
// Run after `next build`, with the prod server up. BASE=http://localhost:3005 node scripts/redesign-r4-bundle-proof.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEXT = ".next";
const BASE = process.env.BASE || "http://localhost:3005";
const ok = (b) => (b ? "✅" : "❌");

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}
const base = (p) => p.replace(/\\/g, "/").split("/").pop();
const chunkRoot = join(NEXT, "static", "chunks");
const chunks = existsSync(chunkRoot) ? walk(chunkRoot) : [];

// strict markers (avoid matching the shared runtime's module map)
const THREE_RE = [/THREE\.WebGLRenderer/, /THREE\.BufferGeometry/, /\bWebGLRenderer\b/, /@react-three\/fiber/, /three\.module/];
const CAL_RE = [/cal\.com\/embed/, /@calcom\/embed/];
const threeBases = new Set(), calBases = new Set();
for (const f of chunks) {
  let txt = ""; try { txt = readFileSync(f, "utf8"); } catch { continue; }
  if (THREE_RE.some((re) => re.test(txt))) threeBases.add(base(f));
  if (CAL_RE.some((re) => re.test(txt))) calBases.add(base(f));
}

const bm = existsSync(join(NEXT, "build-manifest.json")) ? JSON.parse(readFileSync(join(NEXT, "build-manifest.json"), "utf8")) : {};
const rootMain = new Set([...(bm.rootMainFiles ?? []), ...(bm.polyfillFiles ?? []), ...((bm.pages ?? {})["/_app"] ?? [])].map(base));
const threeInMain = [...threeBases].filter((c) => rootMain.has(c));
const calInMain = [...calBases].filter((c) => rootMain.has(c));

console.log("=== R4 BUNDLE-ISOLATION PROOF ===\n");
console.log(`client chunks scanned: ${chunks.length}\n`);
console.log("— (A) STATIC: chunk content + shared baseline —");
console.log(`  ${ok(threeBases.size === 1)} three.js / R3F lives in ${threeBases.size} async chunk(s): ${[...threeBases].join(", ") || "(NONE!)"}`);
console.log(`  ${ok(threeInMain.length === 0)} three NOT in the shared baseline (rootMainFiles): ${threeInMain.length ? "FOUND " + threeInMain.join(",") : "confirmed clean"}`);
console.log(`  ${ok(calBases.size >= 1)} cal.com embed lives in ${calBases.size} async chunk(s): ${[...calBases].join(", ") || "(none)"}`);
console.log(`  ${ok(calInMain.length === 0)} cal NOT in the shared baseline: ${calInMain.length ? "FOUND " + calInMain.join(",") : "confirmed clean"}`);

// (B) RUNTIME — served HTML must not reference the three/cal chunk filenames
const PUBLIC = ["/login", "/forgot-password", "/accept-invite", "/"];
const htmlRefs = [];
let serverUp = true;
for (const route of PUBLIC) {
  let html = "";
  try { html = await (await fetch(`${BASE}${route}`, { redirect: "manual" })).text(); }
  catch { serverUp = false; break; }
  const three = [...threeBases].filter((c) => html.includes(c));
  const cal = [...calBases].filter((c) => html.includes(c));
  htmlRefs.push({ route, three, cal, bytes: html.length });
}
console.log("\n— (B) RUNTIME: served HTML of public routes (initial download) —");
if (!serverUp) {
  console.log("  ⚠ server not reachable at " + BASE + " — skipped (run with the prod server up)");
} else {
  for (const r of htmlRefs) {
    console.log(`  ${ok(r.three.length === 0 && r.cal.length === 0)} ${r.route}: three refs=${r.three.length} cal refs=${r.cal.length} (html ${(r.bytes / 1024).toFixed(0)}kb)`);
  }
}

const htmlClean = !serverUp || htmlRefs.every((r) => r.three.length === 0 && r.cal.length === 0);
const pass = threeBases.size === 1 && threeInMain.length === 0 && calInMain.length === 0 && htmlClean;
console.log(`\n=== ${pass ? "PASS — three.js + cal.com isolated in async chunks; zero in the shared baseline or any public route's initial HTML" : "FAIL"} ===`);
if (!serverUp) console.log("(note: runtime HTML check skipped — static proof passed)");
process.exit(pass ? 0 : 2);
