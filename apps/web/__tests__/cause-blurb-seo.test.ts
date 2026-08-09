import { describe, it, expect } from 'vitest';
import { CAUSES } from '../lib/causes';

// ─────────────────────────────────────────────────────────────────────────────
// `cause.blurb` is not decoration — it is the meta description for every cause
// page (`app/causes/[slug]/page.tsx` uses it in four places: the page metadata,
// the OpenGraph block, the Twitter card and the JSON-LD). Search engines want a
// description of at least ~50 characters, and `e2e/public-quality.spec.ts`
// enforces 50–180 on every indexable route.
//
// ⚠️ THE POINT OF THIS FILE IS THE FEEDBACK LOOP, not the bound itself.
// `/causes/animals-planet` shipped a 48-character blurb. The only thing that
// noticed was a Playwright spec inside a **52-minute** e2e job, which is late
// enough that the practical response is to ignore it. The same fact is
// checkable from the exported constant in milliseconds, so it is checked here
// too — the e2e spec stays as the end-to-end proof that the string actually
// reaches the rendered <meta>, which a unit test genuinely cannot show.
//
// Both directions matter. A blurb that is too LONG is silently truncated by
// Google mid-sentence, so the upper bound is not filler.
// ─────────────────────────────────────────────────────────────────────────────

const MIN = 50;
const MAX = 180;

describe('every cause blurb is a usable meta description', () => {
  it('has causes to check at all', () => {
    // Guards the guard: if `CAUSES` were ever empty or renamed, every `it.each`
    // below would vacuously pass and this file would protect nothing.
    expect(CAUSES.length).toBeGreaterThan(15);
  });

  it.each(CAUSES.map((c) => [c.slug, c.blurb] as const))(
    '/causes/%s — blurb is %s',
    (slug, blurb) => {
      expect(blurb, `${slug} has no blurb`).toBeTruthy();
      expect(
        blurb.length,
        `/causes/${slug} meta description is ${blurb.length} chars, under the ${MIN} floor`,
      ).toBeGreaterThanOrEqual(MIN);
      expect(
        blurb.length,
        `/causes/${slug} meta description is ${blurb.length} chars, over the ${MAX} ceiling`,
      ).toBeLessThanOrEqual(MAX);
    },
  );

  it('trims to the same length it reports', () => {
    // A blurb padded to 50 with trailing whitespace would pass the bound and
    // still render as 48 characters of description.
    for (const c of CAUSES) {
      expect(c.blurb.trim().length, `${c.slug} relies on surrounding whitespace`).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('does not reuse one blurb across two causes', () => {
    // Duplicate meta descriptions are the other half of the same SEO problem,
    // and a copy-paste between neighbouring entries is easy to miss by eye.
    const seen = new Map<string, string>();
    for (const c of CAUSES) {
      const prior = seen.get(c.blurb);
      expect(prior, `/causes/${c.slug} reuses the blurb from /causes/${prior}`).toBeUndefined();
      seen.set(c.blurb, c.slug);
    }
  });
});
