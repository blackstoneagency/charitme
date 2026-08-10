import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// Listing art fails in the upload form, not in the app, and the two ways it
// fails are both invisible on a developer's screen:
//
//  1. App Store Connect REFUSES an icon carrying an alpha channel. The existing
//     `public/icons/icon-512.png` is PNG colour type 6 (RGBA), so reusing it as
//     the 1024 listing icon is an automatic rejection.
//
//  2. Both stores apply their own corner mask. The brand SVG draws an rx="112"
//     tile, so shipping it pre-rounded gets it rounded twice — a visible double
//     edge that no local preview shows, because locally it is just a PNG.
//
// The generator self-checks, but a self-check inside the script that writes the
// files only runs when someone runs it. This runs on every commit.
// ─────────────────────────────────────────────────────────────────────────────

const STORE = path.join(__dirname, '..', 'public', 'store');

const ASSETS = [
  { file: 'ios-icon-1024.png', width: 1024, height: 1024 },
  { file: 'play-icon-512.png', width: 512, height: 512 },
  { file: 'play-feature-graphic.png', width: 1024, height: 500 },
] as const;

describe('store listing art', () => {
  for (const asset of ASSETS) {
    describe(asset.file, () => {
      it('exists', () => {
        expect(existsSync(path.join(STORE, asset.file))).toBe(true);
      });

      it('is exactly the size the store demands', async () => {
        // Both consoles reject a mismatch rather than scaling it.
        const meta = await sharp(path.join(STORE, asset.file)).metadata();
        expect(meta.width).toBe(asset.width);
        expect(meta.height).toBe(asset.height);
      });

      it('carries no alpha channel', async () => {
        const meta = await sharp(path.join(STORE, asset.file)).metadata();
        expect(meta.hasAlpha, 'App Store Connect refuses an icon with alpha').toBe(false);
        expect(meta.channels).toBe(3);
      });
    });
  }

  describe('per-device listing screenshots', () => {
    const SHOTS = path.join(STORE, 'screenshots');
    const DEVICES = [
      { key: 'ios-6.7', width: 1290, height: 2796 },
      { key: 'ios-6.5', width: 1242, height: 2688 },
      { key: 'play-phone', width: 1080, height: 1920 },
    ];

    for (const device of DEVICES) {
      it(`${device.key} images are exactly ${device.width}×${device.height}`, async () => {
        // ⚠️ Both consoles REJECT a size mismatch rather than scaling it, and the
        // trap is Playwright's units: the viewport is CSS pixels and
        // `deviceScaleFactor` multiplies. Passing 1290 with scale 3 yields a
        // 3870px image that looks right in a file listing and fails on upload.
        const files = readdirSync(SHOTS).filter((f) => f.startsWith(`${device.key}-`));
        expect(files.length, `no ${device.key} screenshots found`).toBeGreaterThan(0);
        for (const file of files) {
          const meta = await sharp(path.join(SHOTS, file)).metadata();
          expect({ file, w: meta.width, h: meta.height }).toEqual({
            file,
            w: device.width,
            h: device.height,
          });
        }
      });
    }

    it('covers at least two screens per device, which Play requires', () => {
      for (const device of DEVICES) {
        const files = readdirSync(SHOTS).filter((f) => f.startsWith(`${device.key}-`));
        expect(files.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  it('the in-app icons are deliberately NOT treated this way', async () => {
    // Guards against someone "fixing" the PWA icons to match. A manifest icon is
    // used as-is: it needs its rounding and its transparency, and stripping them
    // would put a purple square on the home screen.
    const meta = await sharp(path.join(__dirname, '..', 'public', 'icons', 'icon-512.png')).metadata();
    expect(meta.hasAlpha).toBe(true);
  });
});
