import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cappedFeaturedIds, CAUSE_FEATURED_CAP } from '../lib/featured-cap';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// At most three highlighted cards on a cause page.
//
// Measured on production once the flags were set: /causes/people-in-need
// returned SIX of six cards ringed and badged, because it spans three
// categories at two featured each. A grid where every card is highlighted
// distinguishes nothing — it is visually identical to one where none is.
//
// The cap is PRESENTATION. It must not unset `campaigns.featured` and must not
// change ordering: that column is what the Stripe webhook sets when a creator
// PAYS for placement, so solving a visual problem by clearing flags would take
// away something people bought.
// ─────────────────────────────────────────────────────────────────────────────

const card = (id: string, featured?: boolean | null) => ({ id, featured });

describe('the cap keeps the highlight meaningful', () => {
  it('keeps only the first three featured cards', () => {
    const ids = cappedFeaturedIds([
      card('a', true), card('b', true), card('c', true), card('d', true), card('e', true),
    ]);
    expect([...ids]).toEqual(['a', 'b', 'c']);
  });

  it('takes them in RENDER order, so the ring follows the position', () => {
    // The list arrives sorted featured-first then by raised. Re-sorting inside
    // the helper is how the highlight would drift away from the top slots.
    const ids = cappedFeaturedIds([
      card('unfeatured-1', false), card('x', true), card('y', true),
      card('unfeatured-2', null), card('z', true), card('w', true),
    ]);
    expect([...ids]).toEqual(['x', 'y', 'z']);
  });

  it('leaves a page under the cap completely alone', () => {
    // The opposite direction, and the common case: 17 of 20 cause pages have
    // four or fewer featured campaigns and must be untouched.
    const ids = cappedFeaturedIds([card('a', true), card('b', true)]);
    expect([...ids]).toEqual(['a', 'b']);
  });

  it('never counts a card whose featured state is unknown', () => {
    // `undefined` means the column was not selected, not "featured". Counting it
    // would let an absent column consume the whole cap and silently strip the
    // ring from campaigns that really are featured.
    const ids = cappedFeaturedIds([
      card('unknown-1'), card('unknown-2'), card('unknown-3'), card('real', true),
    ]);
    expect([...ids]).toEqual(['real']);
  });

  it('the cap is three', () => {
    expect(CAUSE_FEATURED_CAP).toBe(3);
  });

  it('a cap of zero highlights nothing rather than everything', () => {
    // Guards the `cap <= 0` short-circuit: a falsy-cap bug that fell through to
    // the loop would highlight every card, the exact failure being fixed.
    expect(cappedFeaturedIds([card('a', true), card('b', true)], 0).size).toBe(0);
  });
});

describe('the cap is presentation only', () => {
  const lib = read('lib/featured-cap.ts');
  const list = read('app/causes/[slug]/CauseCampaignList.tsx');
  const cardSrc = read('components/CampaignCard.tsx');

  it('drops no cards — the fourth featured campaign still renders', () => {
    // It renders as an ordinary card. Filtering it out would shrink the grid
    // below six and hide a campaign for being too popular.
    expect(list).toMatch(/campaigns\.map\(\(c\) => \(/);
    expect(list, 'the cap must not filter the list').not.toMatch(/campaigns\.filter\(/);
  });

  it('changes no ordering and unsets no flag', () => {
    expect(lib).not.toMatch(/\.sort\(/);
    expect(lib).not.toMatch(/featured\s*=\s*false/);
  });

  it('is computed over the whole rendered list, not one page of six', () => {
    // Held in state, or computed per page, "See more" would add a fourth ring.
    expect(list).toMatch(/const highlighted = cappedFeaturedIds\(campaigns\)/);
  });

  it('leaves every other caller of the card unchanged', () => {
    // Defaulted to true: /campaigns and the homepage must not lose the badge
    // because a cause page needed a cap.
    expect(cardSrc).toMatch(/highlightFeatured = true/);
    expect(cardSrc).toMatch(/const isFeatured = c\.featured === true && highlightFeatured;/);
  });
});
