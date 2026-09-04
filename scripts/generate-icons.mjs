/**
 * Generates the PWA icons and the favicon from the app logo
 * (`public/icons/cepzk-round-logo.png`).
 *
 * Usage: npm run icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve("public/icons/cepzk-round-logo.png");

/** Background behind the (transparent) logo. Matches the theme colour. */
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };
const OUT_DIR = path.resolve("public/icons");
const FAVICON_OUT = path.resolve("src/app/favicon.ico");

const PNG_SIZES = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  // Maskable icons get cropped to the platform's shape: the logo is
  // inset so nothing important sits in the trimmed area.
  { file: "maskable-512.png", size: 512, padding: 0.1 },
  { file: "apple-touch-icon.png", size: 180 },
];

const FAVICON_SIZES = [16, 32, 48];

async function renderPng(size, padding = 0) {
  const inner = Math.round(size * (1 - 2 * padding));
  const logo = await sharp(SOURCE)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

/**
 * Packs PNG data into an ICO container (PNG-compressed entries are
 * supported by all modern browsers).
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  const body = [];

  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(data.length, 8); // bytes in resource
    entry.writeUInt32LE(offset, 12); // image data offset
    entries.push(entry);
    body.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...body]);
}

await mkdir(OUT_DIR, { recursive: true });

for (const { file, size, padding } of PNG_SIZES) {
  const data = await renderPng(size, padding);
  await writeFile(path.join(OUT_DIR, file), data);
  console.log(`✓ public/icons/${file} (${size}x${size})`);
}

const faviconPngs = await Promise.all(
  FAVICON_SIZES.map(async (size) => ({
    size,
    data: await renderPng(size),
  })),
);
await writeFile(FAVICON_OUT, buildIco(faviconPngs));
console.log(`✓ src/app/favicon.ico (${FAVICON_SIZES.join("/")})`);
