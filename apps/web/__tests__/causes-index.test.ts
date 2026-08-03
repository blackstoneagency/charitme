import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAUSES } from '../lib/causes';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/causes/page.tsx');
const browser = read('app/causes/CausesBrowser.tsx');
const stay = read('app/causes/StayInformed.tsx');
const data = read('lib/causes-index.ts');

describe('no fabricated statistics on the causes index', () => {
  it('hardcodes none of the reference figures', () => {
    // The reference asserts a five-figure active-campaign count, an eight-figure
    // raised total, a seven-figure "people helped" and a three-figure country
    // count. "People helped" is not even an entity in this schema — donations are.
    const src = `${page} ${browser} ${data}`;
    for (const fake of ['25,480', '48.7M', '1.2M', '195+', '10.4M']) {
      expect(src, `mock figure "${fake}" must not be hardcoded`).not.toContain(fake);
    }
  });

  it('renders an em-dash for a figure that could not be measured, never 0', () => {
    expect(page).toContain("if (value === null) return '—';");
    expect(page).toContain("if (cents === null) return '—';");
  });

  it('omits a per-cause figure entirely rather than showing 0 when unmeasured', () => {
    // A cause whose count failed to load is not an empty cause.
    expect(browser).toContain('c.campaigns !== undefined');
    expect(browser).toContain('c.raisedCents !== undefined');
  });

  it('sorts causes with an unmeasured figure LAST, not as zero', () => {
    // Ranking a cause we could not count as the least popular states something
    // false about it.
    expect(browser).toContain('missingLast');
    expect(browser).toContain('if (a === undefined) return 1;');
  });
});

describe('reads stay bounded and self-reporting', () => {
  it('takes one limited tally rather than an unbounded scan', () => {
    // An unbounded select costs nothing at 500 rows and takes the page down at
    // 500,000 without announcing the transition.
    expect(data).toContain('const TALLY_LIMIT');
    expect(data).toContain('.limit(TALLY_LIMIT)');
  });

  it('refuses a total when the read came back saturated', () => {
    // A quietly understated total is worse than a missing one: nothing on
    // screen says it is wrong.
    expect(data).toContain('rows.length < TALLY_LIMIT');
    expect(data).toContain('tallyUsable');
  });

  it('derives the platform total from the SAME tally as the cards', () => {
    // Two separate reads would let the headline figure and the cards disagree.
    expect(data).toContain('raisedTotalCents: tallyUsable');
  });

  it('never throws out of the loader', () => {
    // A cold build with Supabase unreachable otherwise 500s the whole route.
    expect(data).toContain('return EMPTY;');
  });
});

describe('the browse controls', () => {
  it('filter pills are buttons with pressed state, not fake tabs', () => {
    expect(browser).toContain('aria-pressed={filter === p.slug}');
    expect(browser).not.toContain('role="tab"');
  });

  it('announces the result of a filter change', () => {
    // Changing a control and having the page silently reflow is the classic
    // screen-reader dead end.
    expect(browser).toContain('role="status"');
    expect(browser).toContain('aria-live="polite"');
  });

  it('derives the pills from the same list the grid renders', () => {
    // So a pill can never point at a cause that is not in the grid.
    expect(browser).toContain('causes.slice(0, 7)');
  });

  it('list view actually changes the layout, not just the label', () => {
    const css = read('app/globals.css');
    expect(css).toContain('.cx-grid.is-list .cx-card');
    expect(css).toContain('grid-template-columns: minmax(0, 190px) minmax(0, 1fr)');
  });
});

describe('the subscribe box is really wired', () => {
  it('posts to the shared marketing capture endpoint', () => {
    // The same path /newsletter uses, so a subscriber lands beside every other
    // contact rather than in a second list nobody maintains.
    expect(stay).toContain('/api/marketing/capture');
    expect(stay).toContain("clientType: 'newsletter'");
    expect(stay).toContain('consentEmail: true');
  });

  it('does not reveal whether an address is already subscribed', () => {
    expect(stay).not.toMatch(/already subscribed/i);
  });

  it('handles the rate limit as its own message', () => {
    expect(stay).toContain('res?.status === 429');
  });
});

describe('every cause reaches the index', () => {
  it('renders all 20, popular first', () => {
    expect(CAUSES.length).toBe(20);
    expect(page).toContain('POPULAR_CAUSES');
    expect(page).toContain('CAUSES.filter');
  });

  it('reuses the mega-menu name key so the twenty names cannot drift', () => {
    expect(page).toContain('nav.cause.${cause.slug}');
  });
});
