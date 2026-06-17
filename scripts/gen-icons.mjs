// Generate the brand favicon / app icons / PWA icons from the real logo.
//
// No dedicated square icon-mark was supplied — only the wide wordmark
// (public/logo.webp). We derive a MARK from its leading "4" glyph (the boldest,
// most legible element at small sizes) as a WHITE silhouette on a charcoal tile.
// FLAGGED as a stopgap: a purpose-drawn mark would be crisper at 16px.
//
//   node scripts/gen-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SRC = "public/logo.webp";
const CHARCOAL = "#18181b";

// 1) isolate the "4" glyph and recolor it to a solid-white silhouette
const trimmed = await sharp(SRC).trim().toBuffer();
const tm = await sharp(trimmed).metadata();
const four = await sharp(trimmed)
  .extract({ left: 0, top: 0, width: Math.round(tm.width * 0.18), height: tm.height })
  .trim()
  .toBuffer();
const fm = await sharp(four).metadata();
const alpha = await sharp(four).ensureAlpha().extractChannel(3).toBuffer();
const whiteFour = await sharp({ create: { width: fm.width, height: fm.height, channels: 3, background: "#ffffff" } })
  .joinChannel(alpha)
  .png()
  .toBuffer();

// 2) compose the mark on a charcoal square tile
async function tile(size, innerFrac) {
  const inner = Math.round(size * innerFrac);
  const scaled = await sharp(whiteFour).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CHARCOAL } })
    .composite([{ input: scaled, gravity: "center" }])
    .png()
    .toBuffer();
}

// 3) minimal PNG-based .ico encoder (all modern browsers accept PNG-in-ICO)
function buildIco(images /* [{size, buf}] */) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, buf } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.buf)]);
}

// favicon.ico (16/32/48) — Next App Router serves app/favicon.ico
const ico = buildIco([
  { size: 16, buf: await tile(16, 0.62) },
  { size: 32, buf: await tile(32, 0.6) },
  { size: 48, buf: await tile(48, 0.58) },
]);
writeFileSync("app/favicon.ico", ico);

// app icon (PNG link) + apple-touch (180, full-bleed — iOS masks the corners)
writeFileSync("app/icon.png", await tile(256, 0.58));
writeFileSync("app/apple-icon.png", await tile(180, 0.56));

// PWA (manifest references these from /public)
writeFileSync("public/icon-192.png", await tile(192, 0.58));
writeFileSync("public/icon-512.png", await tile(512, 0.58));
// maskable: content inside the ~80% safe zone
writeFileSync("public/icon-maskable-512.png", await tile(512, 0.44));

console.log("wrote app/favicon.ico, app/icon.png, app/apple-icon.png, public/icon-{192,512,maskable-512}.png");
console.log("mark = the logo's '4' glyph (white on charcoal). STOPGAP — flag a purpose-drawn mark for crisper small sizes.");
