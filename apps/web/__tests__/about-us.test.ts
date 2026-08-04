import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTeam, parseVideoUrl, initials } from '../lib/about-page';
import { VALID_CATEGORIES, DEFAULTS } from '../lib/settings-defaults';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/about-us/page.tsx');
const teamUi = read('app/about-us/AboutTeam.tsx');
const loader = read('lib/about-page.ts');
const icons = read('components/PublicIcon.tsx');
const hero = read('components/IndexHero.tsx');

// Comments are stripped before every negative assertion: a comment explaining
// why a mock figure is NOT used must not itself trip the guard, or the next
// author deletes the explanation instead of the figure.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('no fabricated statistics', () => {
  it('hardcodes none of the reference figures', () => {
    // The reference asserts "2.3M+ People Helped", "68K+ Lives Transformed",
    // "1,250+ Programs Funded", "120+ Countries Reached" and "98% Funds to
    // Programs". Not one is an entity in this schema.
    const src = stripComments(page);
    for (const fake of ['2.3M', '68K', '1,250', '120+', '98%']) {
      expect(src, `mock figure "${fake}" must not be hardcoded`).not.toContain(fake);
    }
  });

  it('reads its figures from the shared measured loader', () => {
    // The same loader /causes, /campaigns and /how-it-works use, so the four
    // surfaces cannot quote different numbers for the same thing.
    expect(page).toContain('getCausesIndexData');
    expect(page).toContain('statValue(platform.activeCampaigns)');
    expect(page).toContain('moneyValue(platform.raisedTotalCents)');
  });

  it('the one hardcoded percentage is a product fact, not a measurement', () => {
    // 100% reaching the cause is true because PLATFORM_FEE_PERCENT is 0, and it
    // links to the page that shows the arithmetic.
    expect(page).toContain("value: '100%'");
    expect(page).toContain('href="/fees"');
  });

  it('has an icon for every tile it renders', () => {
    // STRIP_ICONS is indexed by tile position. A fifth tile without a fifth
    // icon renders an empty span and says nothing about it.
    // StatStrip is self-closing, so slice on the `tiles` prop itself rather
    // than a closing tag that is never there — the first version of this
    // assertion looked for `</StatStrip>`, matched nothing, and "passed" on an
    // empty string until the >= 5 floor caught it.
    const start = page.indexOf('tiles={[');
    const tiles = page.slice(start, page.indexOf(']}', start));
    expect(start).toBeGreaterThan(0);
    const tileCount = [...tiles.matchAll(/\{\s*value:/g)].length;
    const iconCount = [...hero.matchAll(/<svg key="[a-z]"/g)].length;
    expect(tileCount).toBeGreaterThanOrEqual(5);
    expect(iconCount).toBeGreaterThanOrEqual(tileCount);
  });
});

describe('the roster is real content or no content', () => {
  it('ships no names, titles or headshots in code', () => {
    // The design shows six named executives. Those are claims about real humans
    // on the company's own About page — the section renders from entered rows
    // or not at all.
    const src = stripComments(page) + stripComments(teamUi);
    for (const invented of ['Sarah', 'Michael', 'Emily', 'David', 'Aisha', 'James', 'Chief Executive']) {
      expect(src, `"${invented}" must not be shipped as a team member`).not.toContain(invented);
    }
  });

  it('renders no team section at all when the roster is empty', () => {
    expect(teamUi).toContain('if (members.length === 0) return null;');
  });

  it('drops entries that would render blank rather than showing them', () => {
    expect(parseTeam('[{"name":"","title":"CEO"}]')).toEqual([]);
    expect(parseTeam('[{"name":"Real Person","title":""}]')).toEqual([]);
    expect(parseTeam('[{"name":"Real Person","title":"Head of Impact"}]')).toEqual([
      { name: 'Real Person', title: 'Head of Impact', photo: undefined },
    ]);
  });

  it('survives anything that is not a roster', () => {
    // A malformed paste in an admin box must not take a public page down.
    for (const bad of ['', null, undefined, 'not json', '{}', '[1,2,3]', '["a"]']) {
      expect(parseTeam(bad)).toEqual([]);
    }
  });

  it('accepts jsonb that arrives already parsed', () => {
    // platform_settings.config is jsonb, so the value may come back as an array
    // rather than a string depending on how it was written.
    expect(parseTeam([{ name: 'A B', title: 'Lead' }])).toHaveLength(1);
  });

  it('bounds the roster so a bad paste cannot render an unbounded list', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}`, title: 'Role' }));
    expect(parseTeam(many)).toHaveLength(12);
  });

  it('rejects a non-https headshot rather than rendering a broken image', () => {
    // http would be blocked as mixed content on a page whose job is looking
    // trustworthy.
    expect(parseTeam([{ name: 'A B', title: 'Lead', photo: 'http://x/y.jpg' }])[0].photo).toBeUndefined();
    expect(parseTeam([{ name: 'A B', title: 'Lead', photo: 'javascript:alert(1)' }])[0].photo).toBeUndefined();
    expect(parseTeam([{ name: 'A B', title: 'Lead', photo: 'https://x/y.jpg' }])[0].photo).toBe('https://x/y.jpg');
  });
});

describe('the story video button', () => {
  it('only accepts a real https URL', () => {
    expect(parseVideoUrl('https://example.com/v')).toBe('https://example.com/v');
    for (const bad of ['', '  ', 'not a url', 'http://x/v', null, undefined, 42]) {
      expect(parseVideoUrl(bad)).toBeNull();
    }
  });

  it('renders no control when nothing is configured', () => {
    // A play button that plays nothing is a dead affordance.
    expect(page).toContain('content.storyVideoUrl ?');
    expect(page).toContain(': undefined');
  });
});

describe('the loader reads the live config store', () => {
  it('uses platform_settings, not its superseded predecessor', () => {
    // superseded-tables.test.ts rejects admin_settings by name: it is the
    // untyped key/value predecessor, left readerless because two config stores
    // is how config drifts. This was caught the hard way on the first pass.
    expect(loader).toContain("from('platform_settings')");
    expect(stripComments(loader)).not.toContain('admin_settings');
  });

  it('checks the query error rather than trusting a null row', () => {
    // supabase-js RESOLVES on a failed query, so an unchecked `data` is
    // silently null and every field falls back with nothing saying so.
    expect(loader).toContain('if (error) return FALLBACK;');
  });

  it('never renders an em dash as the company name', () => {
    expect(loader).toContain('name || FALLBACK.companyName');
  });
});

describe('the settings category is wired end to end', () => {
  it('is a valid category, so the generic settings API accepts a save', () => {
    expect(VALID_CATEGORIES).toContain('about');
    expect(DEFAULTS.about).toEqual({ teamRoster: '[]', storyVideoUrl: '' });
  });

  it('ships empty, so nothing renders until someone enters real content', () => {
    expect(parseTeam(DEFAULTS.about.teamRoster)).toEqual([]);
    expect(parseVideoUrl(DEFAULTS.about.storyVideoUrl)).toBeNull();
  });

  it('has an editing surface and a diff label for every field it stores', () => {
    const client = read('app/admin/system/_components/SystemClient.tsx');
    const adminPage = read('app/admin/system/page.tsx');
    expect(adminPage).toContain("key: 'about'");
    expect(client).toContain("case 'about': return renderAboutForm();");
    for (const field of Object.keys(DEFAULTS.about)) {
      expect(client, `${field} needs an editor`).toContain(`'about', '${field}'`);
      expect(client, `${field} needs a diff label`).toMatch(new RegExp(`${field}:\\s*'`));
    }
  });

  it('derives the settings shape instead of restating the category list', () => {
    // Both hand-written copies had already drifted: neither included `footer`,
    // which has been a live settings surface for some time.
    const client = read('app/admin/system/_components/SystemClient.tsx');
    const adminPage = read('app/admin/system/page.tsx');
    expect(client).toContain('Record<SettingsCategory, Record<string, unknown>>');
    expect(adminPage).toContain('VALID_CATEGORIES.map(');
  });
});

describe('icons resolve to real glyphs', () => {
  it('every PublicIcon name used on the page exists in the icon map', () => {
    // PublicIcon falls back to the sparkle for an unknown name WITHOUT
    // erroring, so a typo ships the wrong glyph silently.
    const known = new Set([...icons.matchAll(/^\s{4}([a-z]+):/gm)].map((m) => m[1]));
    expect(known.size).toBeGreaterThan(10);
    const src = stripComments(page);
    const used = [...src.matchAll(/PublicIcon name=\{?['"]?([a-z]+)['"]/g)].map((m) => m[1]);
    const fromData = [...src.matchAll(/^\s*icon: '([a-z]+)',/gm)].map((m) => m[1]);
    const all = [...new Set([...used, ...fromData])];
    expect(all.length).toBeGreaterThan(3);
    for (const name of all) {
      expect(known.has(name), `icon "${name}" is not in PublicIcon`).toBe(true);
    }
  });
});

describe('the sections the reference has', () => {
  it('renders mission, values, impact, story and the closing band', () => {
    for (const id of ['ab-mission', 'ab-values', 'ab-impact-h', 'ab-story-h', 'ab-cta-h']) {
      expect(page, `section ${id} is missing`).toContain(`id="${id}"`);
    }
  });

  it('every value links somewhere real', () => {
    // A value that is only a claim, with nothing behind it, is four paragraphs
    // of assertion.
    for (const href of ['/verification', '/success-stories', '/how-it-works', '/causes']) {
      expect(page, `a value must link to ${href}`).toContain(`href: '${href}'`);
    }
  });
});

describe('the team section when a roster IS entered', () => {
  it('shapes a monogram from the name when no photo was given', () => {
    // The populated branch is the half that matters — the empty one is easy to
    // get right by accident.
    //
    // Asserted here at the data layer rather than by rendering the component:
    // vitest runs with Next's tsconfig, which sets jsx: "preserve" because Next
    // compiles JSX itself, so importing a .tsx in a test does not parse. Making
    // that work is a change to how the whole suite builds, and this page is not
    // the place to make it. What IS reachable is pinned: the shaping function
    // and the markup contract below.
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Grace  Brewster  Murray Hopper')).toBe('GB');
    expect(initials('Prince')).toBe('P');
    expect(initials('  ')).toBe('');
  });

  it('renders a card per member, with the photo only when one was given', () => {
    expect(teamUi).toContain('members.map((member)');
    expect(teamUi).toContain('className="ab-team-card"');
    // The conditional is what keeps a member without a headshot from rendering
    // an <img src="undefined">.
    expect(teamUi).toContain('member.photo ? (');
    expect(teamUi).toContain('initials(member.name)');
  });
});
