#!/usr/bin/env node
/**
 * Generate the store listing artwork that the App Store and Play Console require
 * and this repo did not have.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT "strip the alpha off icon-512.png"
 *
 * mobileGo.md recorded that `icon-512.png` "has an alpha channel and will be
 * rejected as-is". That is true — every shipped PNG icon is colour type 6 — but
 * the fix is not a re-encode. Measured: 150,377 of 262,144 pixels are FULLY
 * transparent. The mark is a logo floating on nothing, not a filled tile with
 * soft corners. Removing the alpha channel without deciding what sits behind it
 * would composite the artwork onto whatever the encoder defaults to.
 *
 * So a background is a decision, and it is made here, once, in the open.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOURCE
 *
 * `public/CharitMe_Logo.png` at 1254x1254 — NOT `public/icons/icon-512.png`.
 * The store icon is 1024, so the 512 would have to be upscaled; the 1254 is
 * downscaled instead. Both carry the same mark.
 *
 * ⚠️ `public/icons/icon-source.svg` is NOT the source of the shipped icon. It
 * draws a purple tile with a white heart; the shipped PNG is a red heart with a
 * "C" cradled by a purple and an orange hand. Rendering the SVG would have
 * produced a confident, clean, WRONG icon — it looks like a source file and is
 * a different design. Caught by reading the centre pixel (209,3,1 — red) before
 * trusting the filename.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OUTPUT CONTRACT
 *
 * · 1024x1024, square, FULL BLEED, no rounded corners — iOS applies its own
 *   squircle mask, so baking corners in produces dark wedges inside the mask.
 * · NO alpha channel: PNG colour type 2, not 6. Apple rejects an icon that
 *   carries an alpha channel even when every pixel in it is opaque.
 * · The mark is inset, so the mask cannot clip it.
 *
 * Usage:
 *   node scripts/generate-store-art.mjs [--background '#000000'] [--out-dir public/store]
 */

import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const WEB = path.join(import.meta.dirname, '..');
const SOURCE = path.join(WEB, 'public', 'CharitMe_Logo.png');
/**
 * ⚠️ WHITE IS MEASURED, NOT A TASTE CALL — and the obvious alternatives are
 * actively wrong.
 *
 * `#000000` (matching the manifest's `background_color`, so the icon would flow
 * seamlessly into the splash) and `#6d35ff` (the declared `theme_color`) were
 * both generated and LOOKED AT first. Both show a light blob between the hands,
 * below the heart. The purple field additionally flattens the purple hand.
 *
 * The cause is in the source art, not the compositor: `CharitMe_Logo.png` has
 * BINARY alpha (0 semi-transparent pixels), and the gap between the hands is
 * filled with OPAQUE near-white — sampled `(627,860)` and `(627,900)` both read
 * `[246,246,245,255]`. A leftover white background baked inside the mark's
 * silhouette is invisible on white and visible on everything else.
 *
 * So: white until the logo is redrawn with that fill made transparent. If it
 * ever is, any background becomes available and `--background` takes it.
 */
const BACKGROUND = argOf('--background', '#ffffff');
const OUT_DIR = path.isAbsolute(argOf('--out-dir', ''))
  ? argOf('--out-dir', '')
  : path.join(WEB, argOf('--out-dir', path.join('public', 'store')));

/** Fraction of the canvas the mark occupies. iOS masks a squircle over the
 *  full square, so a mark that reaches the edge loses its corners. */
const ICON_MARK_SCALE = 0.78;

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`--background must be #rrggbb, got ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Compose the mark, centred, over an opaque field, with NO alpha in the result.
 *
 * `.flatten()` is what removes the channel — `.png()` alone would keep colour
 * type 6 with an all-255 alpha plane, which still reads as "has transparency"
 * to App Store Connect.
 */
async function compose({ width, height, markScale, background, out }) {
  const bg = parseHex(background);
  // Trim the transparent margin first, or the mark is centred by its padding
  // rather than by its own bounding box and reads visibly off-centre.
  const trimmed = await sharp(SOURCE).trim().toBuffer();
  const markSize = Math.round(Math.min(width, height) * markScale);
  const mark = await sharp(trimmed)
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const info = await sharp({
    create: { width, height, channels: 3, background: bg },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    // ⚠️ BOTH calls are needed, and `flatten` alone is the trap. Compositing an
    // RGBA mark onto an opaque base yields a 4-channel result, so `flatten`
    // resolves the transparency against `bg` but the encoder still writes
    // colour type 6 with an all-255 alpha plane. Measured: the first run of
    // this script produced exactly that, and its own header check rejected it.
    // `removeAlpha` is what drops the channel and gets colour type 2.
    .flatten({ background: bg })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);

  return info;
}

/** Read the PNG header back rather than trusting the encoder's promise. */
function describe(file) {
  const b = readFileSync(file);
  const colourType = b[25];
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    colourType,
    hasAlpha: colourType === 4 || colourType === 6 || b.includes(Buffer.from('tRNS')),
    kb: Math.round(b.length / 1024),
  };
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  // App Store. 1024x1024, no alpha — the one that gets a binary rejected.
  { name: 'app-store-icon-1024.png', width: 1024, height: 1024, markScale: ICON_MARK_SCALE },
  // Play Console store icon. Play accepts 32-bit PNG, but an opaque icon is
  // accepted too and matches what the listing actually shows.
  { name: 'play-store-icon-512.png', width: 512, height: 512, markScale: ICON_MARK_SCALE },
];

/**
 * The Play feature graphic is a 1024x500 BANNER across the top of the listing,
 * not another icon slot. The mark alone, centred, reads as an unfinished
 * placeholder at that aspect ratio — so it is the mark plus the product name.
 *
 * ⚠️ Every string here is READ FROM `app/manifest.ts`, never written for the
 * occasion. Store listing copy that disagrees with the app's own manifest is
 * the same defect class as the "$48M+ raised" figures removed from
 * /corporate-partnerships: confident, unverifiable, and nobody's job to check.
 */
function readManifestStrings() {
  const src = readFileSync(path.join(WEB, 'app', 'manifest.ts'), 'utf8');
  const pick = (key) => {
    const m = new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(src);
    if (!m) throw new Error(`could not read ${key} from app/manifest.ts`);
    return m[1].replace(/\\'/g, "'");
  };
  return { name: pick('name'), short: pick('short_name'), description: pick('description') };
}

async function featureGraphic({ background, out }) {
  const bg = parseHex(background);
  const [width, height] = [1024, 500];
  const { short, name, description } = readManifestStrings();
  // "CharitMe — Intelligent Fundraising" minus the short name leaves the
  // positioning line, without restating the brand twice.
  const tagline = name.startsWith(short) ? name.slice(short.length).replace(/^\s*[—–-]\s*/, '') : name;

  const trimmed = await sharp(SOURCE).trim().toBuffer();
  const markSize = Math.round(height * 0.66);
  const mark = await sharp(trimmed).resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const textLeft = 96 + markSize + 56;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="${textLeft}" y="228" font-family="Helvetica, Arial, sans-serif" font-size="82" font-weight="700" fill="#10032e">${escape(short)}</text>
    <text x="${textLeft}" y="292" font-family="Helvetica, Arial, sans-serif" font-size="36" font-weight="600" fill="#6d35ff">${escape(tagline)}</text>
    <text x="${textLeft}" y="352" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#4a4358">${escape(description.split('.')[1]?.trim() || '')}</text>
  </svg>`);

  await sharp({ create: { width, height, channels: 3, background: bg } })
    .composite([
      { input: mark, top: Math.round((height - markSize) / 2), left: 96 },
      { input: svg, top: 0, left: 0 },
    ])
    .flatten({ background: bg })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);
}

const results = [];
for (const t of targets) {
  const out = path.join(OUT_DIR, t.name);
  await compose({ ...t, background: BACKGROUND, out });
  const d = describe(out);
  results.push({ name: t.name, ...d });
  console.log(
    `· ${t.name} — ${d.width}x${d.height} colourType=${d.colourType} alpha=${d.hasAlpha} ${d.kb}KB`,
  );
}

{
  const out = path.join(OUT_DIR, 'play-feature-graphic-1024x500.png');
  await featureGraphic({ background: BACKGROUND, out });
  const d = describe(out);
  results.push({ name: 'play-feature-graphic-1024x500.png', ...d });
  console.log(`· play-feature-graphic-1024x500.png — ${d.width}x${d.height} colourType=${d.colourType} alpha=${d.hasAlpha} ${d.kb}KB`);
}

const bad = results.filter((r) => r.hasAlpha);
if (bad.length > 0) {
  console.log(`\n✗ ${bad.length} file(s) still carry an alpha channel: ${bad.map((b) => b.name).join(', ')}`);
  process.exit(1);
}
console.log(`\n✅ ${results.length} store assets written to ${path.relative(WEB, OUT_DIR)} on ${BACKGROUND}, none carrying an alpha channel`);
