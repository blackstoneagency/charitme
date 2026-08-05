import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Every page that declares `openGraph` must also declare `images`.
//
// ⚠️ This is a Next.js metadata trap, not a style preference.
// `app/opengraph-image.tsx` attaches a social image to every route by FILE
// convention — but ONLY for routes that do not declare `openGraph` themselves.
// Declaring it, even just to set a per-page title, silently drops the image.
//
// Measured 2026-08-04: nine pages — /impact, /volunteer, /fees, /transparency,
// /pricing, /grants, /roles, /help, /refunds — each declared `openGraph` for a
// title and url, and emitted NO og:image at all. Shared to WhatsApp, Slack or X
// they rendered as blank grey cards, on a platform whose growth runs on shared
// links. Six audits (contrast, axe, focus-order, responsive, mobile, vitals)
// passed on all nine: none of them looks at social metadata.
//
// A page routed through `seoMetadata()` is exempt — that helper guarantees the
// image on both of its return paths.
// ─────────────────────────────────────────────────────────────────────────────

const APP = join(__dirname, '..', 'app');

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) { pageFiles(p, out); continue; }
    if (entry === 'page.tsx' || entry === 'layout.tsx') out.push(p);
  }
  return out;
}

describe('a page that declares openGraph keeps its social image', () => {
  const files = pageFiles(APP);

  it('finds pages to check', () => {
    // Keeps the assertion below from passing vacuously if the walk breaks.
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no page declaring openGraph without images', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (!/openGraph:\s*\{/.test(src)) continue;
      // The shared builder fills the gap for its callers.
      if (src.includes('seoMetadata')) continue;
      // ⚠️ Matching only `images: [` was too strict and flagged two pages that
      // were correct: a dynamic route legitimately writes
      // `images: cover ? [cover] : [{ url: DEFAULT_OG_IMAGE }]`, which is the
      // BEST form — the real cover when there is one, the default otherwise.
      //
      // What must never appear is a conditional falling back to `undefined`,
      // which drops the tag exactly when there is no cover — the case where the
      // default matters most. Both of those pages did that before this change.
      if (/\bimages:/.test(src)) {
        const undefinedFallback = /\bimages:[^\n]*:\s*undefined/.test(src);
        expect(undefinedFallback, `${f}: og image falls back to undefined`).toBe(false);
        continue;
      }
      offenders.push(f.slice(f.indexOf('/app/')));
    }
    expect(
      offenders,
      'declares openGraph with no `images`, so Next drops the file-convention ' +
        'og:image and the page shares as a blank card — add ' +
        '`images: [{ url: DEFAULT_OG_IMAGE }]` from lib/public-routes',
    ).toEqual([]);
  });
});
