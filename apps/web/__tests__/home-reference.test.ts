import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/page.tsx');
const css = read('app/globals.css');
const loader = read('lib/home-stories.ts');

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('the reference figures are not fabricated', () => {
  it('hard-codes none of them', () => {
    // The design asserts $48.7M+ raised, 265K+ lives impacted, 128 countries
    // and 58K+ active supporters. None is a number this platform has: the
    // measured totals are three and five figures, not eight.
    const src = stripComments(page);
    for (const fake of ['48.7M', '265K', '58K', '25,000', '4.9']) {
      expect(src, `mock figure "${fake}" must not be hard-coded`).not.toContain(fake);
    }
  });

  it('reads every headline number from the measured loader', () => {
    expect(page).toContain('metrics.raisedCents');
    expect(page).toContain('metrics.donations');
    expect(page).toContain('metrics.campaigns');
    expect(page).toContain('metrics.trustAvg');
  });

  it('suppresses the whole band rather than showing zeroes on a failed read', () => {
    // "0 raised" and "we could not read the total" are opposite claims.
    expect(page).toContain('shouldShowPlatformMetrics');
    expect(page).toContain('{metricsAvailable && (');
  });

  it('publishes no star rating or review count, because there is no such table', () => {
    // The reference puts "4.9 ★★★★★ from 25,000+ reviews" under the hero
    // buttons. There is no reviews or ratings table in this schema, so both the
    // score and the count would be invented.
    const src = stripComments(page);
    expect(src).not.toMatch(/reviews/i);
    expect(src).not.toContain('★');
  });

  it('does not use real users\' faces as anonymous marketing', () => {
    // The reference's five-face avatar cluster. The only real faces available
    // are `profiles.avatar_url` — identifiable people who did not agree to be
    // the homepage's social proof.
    const src = stripComments(page);
    expect(src).not.toContain('avatar_url');
    expect(src).not.toContain('avatar');
  });

  it('puts measured figures in that slot instead', () => {
    expect(page).toContain('mirror-hero-proof');
    expect(page).toContain('Average trust score');
  });
});

describe('nothing is labelled as something it cannot do', () => {
  it('has no play control anywhere, because there is no playable video', () => {
    // Every `campaign_media` video row points at a reserved `.example` host,
    // which cannot resolve by construction (RFC 2606). The reference draws a
    // "Watch Our Impact" button and a start-media control over the lead story.
    const src = stripComments(page);
    expect(src).not.toContain('Watch Our Impact');
    expect(src).not.toContain('Watch Story');
    expect(src).not.toMatch(/name="play"/);
  });

  it('labels the story card as reading, since it opens a campaign page', () => {
    expect(page).toContain('Read the story');
  });

  it('attributes quotes to real donations, never to invented people', () => {
    // The reference's quotes are attributed to "Maria S., Single Mom" and
    // "James T., Scholarship Recipient", with photographs. Inventing a
    // testimonial with a face attached is a fabricated endorsement.
    const src = stripComments(page);
    expect(src).not.toContain('Maria');
    expect(src).not.toContain('James');
    expect(src).not.toContain('Single Mom');
    expect(page).toContain('recentDonations.slice(0, 2)');
  });
});

describe('the stories band is real, bounded and failure-safe', () => {
  it('reads genuinely completed campaigns', () => {
    expect(loader).toContain("eq('status', 'completed')");
    expect(loader).toContain('applyVisibilityFilters');
  });

  it('is bounded, like every other homepage read', () => {
    expect(loader).toContain('boundedQuery');
    expect(loader).toContain('.limit(limit)');
  });

  it('distinguishes a failed read from an empty platform', () => {
    // `null` = the query failed; `[]` = there are genuinely no completed
    // campaigns. Conflating them makes an outage look like a young platform.
    expect(loader).toContain('return null;');
    expect(loader).toContain('if (error) return null;');
  });

  it('renders no band at all when there is no story to lead with', () => {
    expect(page).toContain('{leadStory && (');
  });

  it('excludes deleted campaigns', () => {
    expect(loader).toContain("is('deleted_at', null)");
  });
});

describe('the layout follows the reference', () => {
  it('gives the hero two columns with a contained photo', () => {
    expect(page).toContain('mirror-hero-media');
    expect(css).toContain('.mirror-hero-inner { grid-template-columns: minmax(0, 1fr) minmax(0, 0.92fr); }');
  });

  it('dropped the full-bleed background and its shade rather than orphaning them', () => {
    // The photo used to be an absolutely-positioned background under a 70%
    // black shade. Both selectors are gone, not left unused.
    expect(css).not.toContain('.mirror-hero-bg');
    expect(css).not.toContain('.mirror-hero-shade');
    expect(page).not.toContain('mirror-hero-bg');
  });

  it('carries the floating "Real People. Real Impact." card', () => {
    expect(page).toContain('mirror-hero-card');
    expect(page).toContain('Real Impact.');
    expect(page).toContain('View Stories');
  });

  it('splits stories and the impact CTA into their own bands', () => {
    expect(page).toContain('mirror-stories');
    expect(page).toContain('Stories That Inspire Hope');
    expect(page).toContain('mirror-impact-cta');
    expect(page).toContain('Make an Impact Today');
  });

  it('keeps the #impact anchor the header and footer link', () => {
    expect(page).toContain('id="impact"');
  });

  it('every inline grid track is minmax(0, …) so a child cannot force overflow', () => {
    // The mobile-grid-tracks rule: `1fr` resolves to the content's min-content
    // width, which is how a feed ended up 288px wide inside a 320px viewport.
    for (const rule of [
      '.mirror-stories-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }',
      '.mirror-hero-inner { grid-template-columns: minmax(0, 1fr) minmax(0, 0.92fr); }',
    ]) {
      expect(css, `expected track rule: ${rule}`).toContain(rule);
    }
  });
});
