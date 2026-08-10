import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Store listing artwork, and the one property that gets a build REJECTED.
//
// Apple refuses an App Store icon that carries an alpha channel — and it refuses
// it even when every pixel in that channel is opaque, so "it looks fine" proves
// nothing. Every icon this repo already shipped is colour type 6:
//
//   icon-512.png · icon-512-maskable.png · icon-192.png · apple-touch-icon.png
//
// ⚠️ The fix was NOT a re-encode of those. Measured: 150,377 of 262,144 pixels in
// icon-512.png are FULLY transparent — the mark is a logo floating on nothing,
// not a filled tile. Dropping the channel without choosing what sits behind it
// composites the artwork onto whatever the encoder happens to default to.
//
// ⚠️ And the source is `public/CharitMe_Logo.png` (1254x1254), NOT
// `public/icons/icon-source.svg`. That SVG draws a purple tile with a white
// heart; the shipped mark is a red heart with a "C" between a purple and an
// orange hand. Rendering the file whose name says "source" would have produced a
// clean, confident, wrong icon.
//
// These assertions read the PNG header directly rather than trusting the
// generator, because the generator is the thing most likely to regress.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = path.join(__dirname, '..');
const STORE = path.join(WEB, 'public', 'store');

type Png = { width: number; height: number; colourType: number; hasAlpha: boolean };

function readPng(file: string): Png {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString(), `${file} is not a PNG`).toBe('PNG');
  const colourType = b[25];
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    colourType,
    // 4 = grey+alpha, 6 = RGBA, and a tRNS chunk adds transparency to any type.
    hasAlpha: colourType === 4 || colourType === 6 || b.includes(Buffer.from('tRNS')),
  };
}

const ASSETS = [
  { file: 'app-store-icon-1024.png', width: 1024, height: 1024, why: 'App Store icon' },
  { file: 'play-store-icon-512.png', width: 512, height: 512, why: 'Play store icon' },
  { file: 'play-feature-graphic-1024x500.png', width: 1024, height: 500, why: 'Play feature graphic' },
] as const;

describe('store listing artwork exists at the sizes the consoles demand', () => {
  for (const { file, width, height, why } of ASSETS) {
    it(`${file} is ${width}x${height} (${why})`, () => {
      const png = readPng(path.join(STORE, file));
      expect(png.width).toBe(width);
      expect(png.height).toBe(height);
    });
  }
});

describe('no store asset carries an alpha channel', () => {
  for (const { file } of ASSETS) {
    it(`${file} is opaque, colour type 2`, () => {
      const png = readPng(path.join(STORE, file));
      expect(png.hasAlpha, `${file} would be rejected by App Store Connect`).toBe(false);
      expect(png.colourType, `${file} should be truecolour without alpha`).toBe(2);
    });
  }
});

describe('the listing banner says what the manifest says', () => {
  // Store copy that disagrees with the app's own manifest is the same defect
  // class as the fabricated "$48M+ raised" figures removed from
  // /corporate-partnerships — confident, unverifiable, nobody's job to check.
  // The generator reads these strings; this asserts it still has them to read.
  const manifest = readFileSync(path.join(WEB, 'app', 'manifest.ts'), 'utf8');
  const generatorSource = readFileSync(path.join(WEB, 'scripts', 'generate-store-art.mjs'), 'utf8');
  // ⚠️ Comments must be stripped before asserting copy is absent. The generator
  // EXPLAINS how it derives the tagline and naturally quotes it while doing so;
  // matching the raw file fails on the explanation rather than on any hardcoded
  // string. Same trap `no-fabricated-partner-claims.test.ts` documents.
  const generator = generatorSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  it('reads name, short_name and description out of the manifest', () => {
    expect(generatorSource).toContain("pick('name')");
    expect(generatorSource).toContain("pick('short_name')");
    expect(generatorSource).toContain("pick('description')");
  });

  it('hardcodes no product copy of its own', () => {
    expect(generator).not.toMatch(/'CharitMe\s*—/);
    expect(generator).not.toMatch(/Intelligent Fundraising/);
  });

  it('still finds the strings it parses for', () => {
    for (const key of ['name', 'short_name', 'description']) {
      expect(manifest, `manifest.ts lost ${key}, so the banner cannot be regenerated`)
        .toMatch(new RegExp(`${key}:\\s*'`));
    }
  });
});

describe('the alpha problem in the shipped app icons is recorded, not forgotten', () => {
  it('the app icons still carry alpha — which is correct for a web manifest', () => {
    // Not a bug to fix: a PWA icon on transparency is right, and Android masks
    // it. This asserts the DISTINCTION is real, so nobody "fixes" the web icons
    // by flattening them and quietly changes how the installed app looks.
    const appIcon = readPng(path.join(WEB, 'public', 'icons', 'icon-512.png'));
    expect(appIcon.hasAlpha).toBe(true);
    const storeIcon = readPng(path.join(STORE, 'app-store-icon-1024.png'));
    expect(storeIcon.hasAlpha).toBe(false);
  });
});
