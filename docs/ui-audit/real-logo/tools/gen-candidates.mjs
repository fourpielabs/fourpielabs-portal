// Explore mark options derived from the wordmark (no dedicated icon-mark was supplied).
//   node docs/ui-audit/real-logo/tools/gen-candidates.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "docs/ui-audit/real-logo/candidates";
mkdirSync(OUT, { recursive: true });
const SRC = "public/logo.webp";

// tight bounds of the full logo
const trimmed = await sharp(SRC).trim().toBuffer();
const meta = await sharp(trimmed).metadata();
console.log("trimmed logo:", meta.width, "x", meta.height);
await sharp(trimmed).png().toFile(`${OUT}/00-trimmed.png`);

// dark transparent logo -> solid-white silhouette (alpha preserved)
async function white(buf) {
  const m = await sharp(buf).metadata();
  const alpha = await sharp(buf).ensureAlpha().extractChannel(3).toBuffer();
  return sharp({ create: { width: m.width, height: m.height, channels: 3, background: "#ffffff" } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

const W = meta.width;
const H = meta.height;
for (const [name, frac] of [["4", 0.18], ["4P", 0.27], ["4Pi", 0.36], ["4Pie", 0.62]]) {
  const cw = Math.round(W * frac);
  const crop = await sharp(trimmed).extract({ left: 0, top: 0, width: cw, height: H }).trim().toBuffer();
  await sharp(crop).png().toFile(`${OUT}/crop-${name}.png`);
  // white mark on a charcoal rounded tile (preview at 256)
  const wbuf = await white(crop);
  const tile = 256;
  const inner = Math.round(tile * 0.6);
  const scaled = await sharp(wbuf).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  await sharp({ create: { width: tile, height: tile, channels: 4, background: "#18181b" } })
    .composite([{ input: scaled, gravity: "center" }])
    .png()
    .toFile(`${OUT}/tile-${name}.png`);
}
console.log("candidates →", OUT);
