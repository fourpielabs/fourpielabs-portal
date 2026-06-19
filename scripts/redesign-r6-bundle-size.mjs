// R6 GATE 4 — bundle-size measurement (run on each build for the redesign-vs-main delta).
// Reports: total static JS, the shared baseline (rootMainFiles), and /login initial JS.
// BASE=http://localhost:3005 node scripts/redesign-r6-bundle-size.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3005";
const base = (p) => p.split(/[\\/]/).pop();
function walk(d) { let o = []; for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) o.push(...walk(p)); else if (e.name.endsWith(".js")) o.push(p); } return o; }
const sizeOf = (f) => { try { return statSync(f).size; } catch { return 0; } };

const chunks = walk(".next/static/chunks");
const totalJs = chunks.reduce((s, f) => s + sizeOf(f), 0);
const bm = JSON.parse(readFileSync(".next/build-manifest.json", "utf8"));
const root = [...(bm.rootMainFiles || []), ...(bm.polyfillFiles || [])].map(base);
const byBase = new Map(chunks.map((f) => [base(f), sizeOf(f)]));
const rootBytes = root.reduce((s, b) => s + (byBase.get(b) || 0), 0);

let loginBytes = 0, loginChunks = 0;
try {
  const html = await (await fetch(`${BASE}/login`)).text();
  const refs = [...new Set((html.match(/[\w.\-/]+\.js/g) || []).map(base))].filter((b) => byBase.has(b));
  loginChunks = refs.length;
  loginBytes = refs.reduce((s, b) => s + byBase.get(b), 0);
} catch { /* server not up — skip login measure */ }

const kb = (n) => (n / 1024).toFixed(0) + "kb";
console.log(JSON.stringify({
  chunks: chunks.length,
  totalJs: kb(totalJs),
  rootBaseline: kb(rootBytes),
  loginInitial: loginChunks ? kb(loginBytes) : "n/a (server down)",
  raw: { totalJs, rootBytes, loginBytes },
}, null, 2));
