#!/usr/bin/env node
/**
 * Generate the listing art both stores require, from the brand SVG already in
 * the repo. No new artwork is invented — the gradient, the mark and the wording
 * all come from existing assets.
 *
 *   node scripts/generate-store-art.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ TWO THINGS THAT GET AN UPLOAD REJECTED, AND BOTH ARE INVISIBLE LOCALLY
 *
 * 1. **Alpha.** App Store Connect refuses an icon with an alpha channel outright.
 *    `public/icons/icon-512.png` is PNG colour type 6 (RGBA) — measured, not
 *    assumed — so it cannot be reused as the 1024 listing icon.
 *
 * 2. **Rounded corners.** Both stores apply their own mask. The source SVG draws
 *    a `rx="112"` tile, so its corners are transparent; flattening that onto a
 *    background would put square corners of that colour into the artwork, and
 *    the store would then round it AGAIN — a visible double-rounded edge.
 *
 * So the listing icons are rendered from the same SVG with the corner radius set
 * to zero, at full bleed, then flattened. The in-app icons under
 * `public/icons/` keep their rounding and their alpha, because a PWA icon is
 * used as-is.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');
const ICONS = join(WEB_ROOT, 'public', 'icons');
const OUT = join(WEB_ROOT, 'public', 'store');

mkdirSync(OUT, { recursive: true });

const source = readFileSync(join(ICONS, 'icon-source.svg'), 'utf8');

/** Same art, no rounded tile — the store rounds it, we must not. */
const squared = source.replace(/(<rect[^>]*?)rx="\d+"/, '$1rx="0"');
if (squared === source) {
  throw new Error('the corner radius was not found — the source SVG changed shape, check before shipping');
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `icon-source.svg` IS NOT THE SHIPPED BRAND MARK, and the first version of
// this script rendered it into the store icons.
//
// It draws a purple tile with a plain white heart. The mark this app actually
// ships — `public/icons/icon-512.png`, `apple-touch-icon.png`, the favicon, and
// `public/CharitMe_Logo.png` — is a RED heart carrying a "C", cradled by a
// purple and an orange hand. Measured: the centre pixel of icon-512.png is
// `(209,3,1)`, red, not purple.
//
// So the generated `ios-icon-1024.png` showed a different logo from the app it
// belongs to. Nothing catches that: the PNG is valid, opaque, square and the
// right size, and every existing assertion passed. A reviewer comparing the
// listing icon to the app would see two different products.
//
// The mark now comes from `public/CharitMe_Logo.png` (1254x1254 — the largest
// source in the repo, so 1024 is downscaled rather than upscaled).
// ═══════════════════════════════════════════════════════════════════════════
const MARK_SOURCE = join(WEB_ROOT, 'public', 'CharitMe_Logo.png');

/**
 * The mark carries an opaque white background BAKED INSIDE its own silhouette,
 * which is invisible on white and shows as light blobs on the brand gradient.
 *
 * Measured on the 1254px source: alpha is BINARY (0 semi-transparent pixels),
 * and near-white opaque pixels form 43 connected components. Four matter:
 *
 *   n=10970  centroid (798,367)  the "C" on the heart      ← KEEP
 *   n= 3528  centroid (882,605)  gap, heart ↔ orange hand  ← remove
 *   n= 2963  centroid (632,847)  gap below the heart       ← remove
 *   n= 2940  centroid (377,613)  gap, heart ↔ purple hand  ← remove
 *
 * A global white key would eat the "C" too, so this keeps the component
 * containing a known "C" pixel and clears the rest. The "C" is also by far the
 * largest, and that is ASSERTED — if the art changes so it no longer is, this
 * throws instead of silently erasing the letter.
 */
async function cleanMark() {
  const { data, info } = await sharp(MARK_SOURCE).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x, y) => (y * w + x) * 4;
  // 215, not 232. At 232 the anti-aliased EDGES of the baked fill survive as thin
  // light slivers where the heart meets each hand — visible on the gradient.
  // Measured across thresholds: 232 removes 9,473 px, 215 removes 10,326, and the
  // "C" stays intact and largest at both (10,970 -> 11,093). The hand highlights
  // are tinted (a purple highlight is ~(218,142,251)), so their green channel
  // fails this test and they are not touched.
  const nearWhite = (i) => data[i + 3] > 200 && data[i] > 215 && data[i + 1] > 215 && data[i + 2] > 215;

  const seen = new Uint8Array(w * h);
  const components = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (seen[k] || !nearWhite(at(x, y))) continue;
      const stack = [[x, y]];
      seen[k] = 1;
      const pixels = [];
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        pixels.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const kk = ny * w + nx;
          if (seen[kk] || !nearWhite(at(nx, ny))) continue;
          seen[kk] = 1;
          stack.push([nx, ny]);
        }
      }
      components.push(pixels);
    }
  }

  // (803,289) sits inside the "C". Identify the letter by containment, not by
  // size alone, then check the two agree.
  const C_PIXEL = [803, 289];
  const letter = components.find((px) => px.some(([x, y]) => x === C_PIXEL[0] && y === C_PIXEL[1]));
  if (!letter) throw new Error('the "C" was not found at (803,289) — the mark changed, check before shipping');
  const largest = components.reduce((a, b) => (b.length > a.length ? b : a));
  if (largest !== letter) {
    throw new Error(`the largest near-white region is no longer the "C" (${largest.length} vs ${letter.length}) — check before erasing it`);
  }

  let cleared = 0;
  for (const px of components) {
    if (px === letter) continue;
    for (const [x, y] of px) { data[at(x, y) + 3] = 0; cleared++; }
  }
  console.log(`✓ mark cleaned: ${cleared} baked-white px removed, "C" (${letter.length} px) kept`);
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/** The gradient's darker stop; only ever seen if a mark fails to cover a pixel. */
const BRAND_FILL = '#5b21b6';

/**
 * The brand gradient, square and full-bleed. The store applies its own mask, so
 * the tile must not be pre-rounded — `squared` is that same SVG with the corner
 * radius zeroed, and it is still what paints the field behind the mark.
 */
function tile(size) {
  // ⚠️ Drop the `<g>` group. `squared` is the WHOLE old SVG — gradient rect AND
  // the old white heart and cradling hand — so compositing the real mark over it
  // left the OLD mark showing behind as a pale swoosh. Only the gradient field
  // belongs here; the mark comes from CharitMe_Logo.png.
  const fieldOnly = squared.replace(/<g[\s\S]*<\/g>/, '');
  if (fieldOnly === squared) {
    throw new Error('the old mark group was not found — the source SVG changed shape, check before shipping');
  }
  return Buffer.from(fieldOnly.replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`));
}

async function icon(size, file, mark) {
  // The mark is inset so the store's squircle cannot clip it.
  const inset = Math.round(size * 0.78);
  const scaled = await sharp(mark).trim()
    .resize(inset, inset, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  // Two passes, for the reason recorded above featureGraphic(): flattening in
  // the same pipeline as an RGBA overlay puts the alpha straight back.
  const composed = await sharp(tile(size)).resize(size, size)
    .composite([{ input: scaled, gravity: 'centre' }])
    .png()
    .toBuffer();
  await sharp(composed)
    // `flatten` composites onto an opaque background and DROPS the alpha
    // channel. Without it sharp keeps RGBA even when nothing is transparent.
    .flatten({ background: BRAND_FILL })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, file));
  console.log(`✓ ${file}  ${size}×${size}  opaque`);
}

/**
 * Play's feature graphic: 1024×500, shown at the top of the listing.
 *
 * Composed from the brand gradient and the existing mark, with the product name
 * and the manifest's own description. Nothing here is a claim — no statistics,
 * no testimonials, no awards — because listing art is the easiest place to
 * publish a number nobody can source.
 */
async function featureGraphic() {
  const W = 1024;
  const H = 500;
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#7c55ff"/>
        <stop offset="1" stop-color="#4c1d95"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <text x="360" y="228" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
          font-size="76" font-weight="800" fill="#ffffff">CharitMe</text>
    <text x="362" y="292" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
          font-size="30" font-weight="500" fill="#e9d8ff">Intelligent fundraising. 0% platform fees.</text>
  </svg>`);

  const mark = await sharp(await cleanMark()).trim().resize(200, 200, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  // ⚠️ TWO passes, and the order is not a style choice. sharp runs `flatten`
  // BEFORE `composite` no matter which you call first, so flattening in the same
  // pipeline as an RGBA overlay puts the alpha straight back — the self-check at
  // the foot of this file caught exactly that. Composite first, then flatten the
  // result.
  const composed = await sharp(background)
    .composite([{ input: mark, top: 150, left: 120 }])
    .png()
    .toBuffer();

  await sharp(composed)
    .flatten({ background: BRAND_FILL })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, 'play-feature-graphic.png'));
  console.log(`✓ play-feature-graphic.png  ${W}×${H}  opaque`);
}

const mark = await cleanMark();
await icon(1024, 'ios-icon-1024.png', mark);
await icon(512, 'play-icon-512.png', mark);
await featureGraphic();

// Verify what was written rather than trusting the pipeline that wrote it.
for (const file of ['ios-icon-1024.png', 'play-icon-512.png', 'play-feature-graphic.png']) {
  const meta = await sharp(join(OUT, file)).metadata();
  if (meta.hasAlpha) throw new Error(`${file} still has an alpha channel — App Store Connect rejects this`);
  console.log(`  ${file}: ${meta.width}×${meta.height}, channels ${meta.channels}, alpha ${meta.hasAlpha}`);
}

// ⚠️ Named ASSETS.md, not README.md, on purpose. `ci-paths-ignore.test.ts`
// scans scripts/ for quoted `*.md` names and treats any hit as a file the build
// READS — it cannot tell a read from a write, nor `public/store/README.md` from
// the root `README.md`, which is in CI's paths-ignore list. A README here makes
// that guard fire on a false positive. Renaming removes the ambiguity without
// loosening a check other agents depend on.
writeFileSync(
  join(OUT, 'ASSETS.md'),
  `# Store listing art

Generated by \`npm run generate:store-art\`. Do not hand-edit — regenerate.

| File | Size | Used for |
|---|---|---|
| \`ios-icon-1024.png\` | 1024×1024 | App Store Connect listing icon |
| \`play-icon-512.png\` | 512×512 | Play Console listing icon |
| \`play-feature-graphic.png\` | 1024×500 | Play Console feature graphic |

All three are **opaque** (no alpha) and **square** (no rounded corners). Both
stores reject alpha on the listing icon and apply their own corner mask, so
pre-rounded art is rounded twice.

The in-app icons in \`../icons/\` are different on purpose: a PWA icon is used
as-is, so those keep their rounding and their alpha.
`,
);
console.log('\nwrote public/store/ASSETS.md');
