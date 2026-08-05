import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The `feature` variant is the quieter card from the cause-landing reference.
// The risk in a "match the mock" change is that a cleaner layout silently drops
// information a donor decides on. These tests pin what may and may not go.

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const card = read('components/CampaignCard.tsx');
const feature = card.slice(card.indexOf("if (variant === 'feature')"), card.indexOf('  return (\n    <Link href={`/campaigns/${c.slug}`} style'));

describe('the feature card is one component, not a copy', () => {
  it('is a variant of CampaignCard rather than a separate file', () => {
    // This repo's recurring failure is a lookalike that drifts — three copies of
    // the category list, five of the public-route list, ten of "days left", one
    // of which shipped "136 days left" above "This campaign has ended".
    expect(card).toContain("variant?: 'full' | 'feature'");
    expect(card).toContain("if (variant === 'feature')");
  });

  it('derives its percentage and time label from the shared helpers', () => {
    // Not recomputed locally: that is precisely how two cards come to disagree.
    expect(card).toContain('campaignTimeLabel(');
    expect(card).toContain('Math.min(100, Math.round(');
    // One `pct` and one `daysLabel` for both variants.
    expect(card.match(/const pct = /g) ?? []).toHaveLength(1);
    expect(card.match(/const daysLabel = /g) ?? []).toHaveLength(1);
  });
});

describe('what the quieter layout may NOT drop', () => {
  it('still marks a verified campaign', () => {
    // The reference shows no status chips. Verified is a signal a donor decides
    // on, so it survives the simplification.
    expect(feature).toContain('isVerified');
    expect(feature).toMatch(/Verified/);
  });

  it('still marks an ENDED campaign', () => {
    // The specific bug this guards: a finished campaign that reads as live.
    expect(feature).toContain('hasEnded');
    expect(feature).toMatch(/Ended/);
  });

  it('still shows real raised-of-goal money and a progress bar', () => {
    // Whole currency, as the reference writes it — cents are noise on a card
    // headline — via the SHARED compact helper, not a local rounding of its own.
    expect(feature).toContain('formatMoneyCompact(c.raised_amount ?? 0, currency)');
    expect(feature).toContain('formatMoneyCompact(c.goal_amount, currency)');
    expect(feature).not.toContain('formatCents(');
    expect(feature).toContain('<ProgressBar');
    expect(feature).toContain('{pct}%');
  });

  it('links to the real campaign, not a placeholder', () => {
    expect(feature).toContain('href={`/campaigns/${c.slug}`}');
  });
});

describe('what it deliberately drops', () => {
  it('omits the numeric trust score and the donor/goal tiles', () => {
    // These are the visual noise the reference removes. The verified BADGE
    // above carries the trust signal that changes a decision; the raw number
    // does not, on a card this size.
    expect(feature).not.toContain('getTrustLabel');
    expect(feature).not.toContain("label: 'Donors'");
  });

  it('clamps the description in CSS rather than slicing the string', () => {
    // The full card does `tagline.slice(0, 90)`, which cuts at a different place
    // at every width and mid-word at some of them.
    expect(feature).not.toContain('.slice(0, 90)');
    expect(read('app/globals.css')).toContain('-webkit-line-clamp: 2');
  });
});

describe('the other five pages are untouched', () => {
  it('only the cause landing opts into the feature variant', () => {
    const users = [
      'app/campaigns/(list)/page.tsx',
      'app/search/page.tsx',
      'app/donate/page.tsx',
      'app/supporter-space/page.tsx',
    ];
    for (const p of users) {
      expect(read(p), `${p} must keep the dense listing card`).not.toContain('variant="feature"');
    }
    // The cause grid moved into `CauseCampaignList` when the page went to six
    // campaigns plus a "See more" button, so the opt-in lives there now. The
    // claim being pinned is unchanged: the cause landing is the ONLY surface
    // using the feature card, and the four dense listings above still are not.
    expect(read('app/causes/[slug]/CauseCampaignList.tsx')).toContain('variant="feature"');
  });

  it('the feature card uses surface tokens, not the mock’s literal white', () => {
    const css = read('app/globals.css');
    const block = css.slice(css.indexOf('.cc-feature {'), css.indexOf('.cc-feature-pct'));
    expect(block).toContain('var(--s1)');
    expect(block).not.toMatch(/background:\s*#fff/i);
    expect(block).not.toMatch(/background:\s*white/i);
  });
});
