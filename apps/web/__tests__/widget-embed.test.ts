import { describe, it, expect } from 'vitest';
import {
  parseWidgetOptions,
  widgetQuery,
  widgetPath,
  widgetHeight,
  embedSnippet,
  clampWidth,
  DEFAULT_WIDGET_OPTIONS,
  WIDGET_MIN_WIDTH,
  WIDGET_MAX_WIDTH,
  type WidgetOptions,
} from '../lib/widget-embed';

const opts = (over: Partial<WidgetOptions> = {}): WidgetOptions => ({ ...DEFAULT_WIDGET_OPTIONS, ...over });

describe('parseWidgetOptions', () => {
  it('returns the defaults for an empty query', () => {
    expect(parseWidgetOptions({})).toEqual(DEFAULT_WIDGET_OPTIONS);
  });

  it('never throws on garbage — a broken query renders the default widget', () => {
    // The visitor inside a fundraiser's iframe cannot fix a malformed URL. An
    // error page in that frame is a dead donation box on someone else's site.
    expect(parseWidgetOptions({ theme: 'chartreuse', cover: 'yes', width: 'wide' })).toEqual(
      DEFAULT_WIDGET_OPTIONS,
    );
    expect(parseWidgetOptions({ width: 'NaN' }).width).toBe(DEFAULT_WIDGET_OPTIONS.width);
  });

  it('reads each flag off', () => {
    expect(parseWidgetOptions({ cover: '0' }).showCover).toBe(false);
    expect(parseWidgetOptions({ progress: '0' }).showProgress).toBe(false);
    expect(parseWidgetOptions({ donors: 'false' }).showDonorCount).toBe(false);
    expect(parseWidgetOptions({ theme: 'dark' }).theme).toBe('dark');
  });

  it('takes the first value when a param repeats', () => {
    expect(parseWidgetOptions({ theme: ['light', 'dark'] }).theme).toBe('light');
  });
});

describe('clampWidth', () => {
  it('holds the widget inside a usable range', () => {
    expect(clampWidth(10)).toBe(WIDGET_MIN_WIDTH);
    expect(clampWidth(99999)).toBe(WIDGET_MAX_WIDTH);
    expect(clampWidth(420)).toBe(420);
    expect(clampWidth(Number.NaN)).toBe(DEFAULT_WIDGET_OPTIONS.width);
  });
});

describe('round trip', () => {
  // This is the property the whole module exists for: the preview panel and the
  // copied snippet must resolve to the same widget. If widgetQuery and
  // parseWidgetOptions disagree, the fundraiser approves one thing and publishes
  // another, and only finds out in public.
  const cases: WidgetOptions[] = [
    DEFAULT_WIDGET_OPTIONS,
    opts({ theme: 'dark' }),
    opts({ theme: 'light', showCover: false }),
    opts({ showProgress: false, showDonorCount: false }),
    opts({ theme: 'dark', showCover: false, showProgress: false, showDonorCount: false }),
  ];

  for (const o of cases) {
    it(`survives ${JSON.stringify(o)}`, () => {
      const query = widgetQuery(o);
      const parsed = parseWidgetOptions(
        Object.fromEntries(new URLSearchParams(query.replace(/^\?/, ''))),
      );
      // Width is not carried in the query by design — it sizes the frame, not
      // the page — so compare everything else.
      expect({ ...parsed, width: o.width }).toEqual(o);
    });
  }

  it('emits nothing at all for the default options', () => {
    expect(widgetQuery(DEFAULT_WIDGET_OPTIONS)).toBe('');
    expect(widgetPath('save-the-bees', DEFAULT_WIDGET_OPTIONS)).toBe('/campaigns/save-the-bees/embed');
  });

  it('does not put width in the query', () => {
    expect(widgetQuery(opts({ width: 590 }))).not.toContain('width');
  });
});

describe('widgetHeight', () => {
  it('shrinks when parts are hidden, so the iframe has no dead band', () => {
    const full = widgetHeight(DEFAULT_WIDGET_OPTIONS);
    expect(widgetHeight(opts({ showCover: false }))).toBeLessThan(full);
    expect(widgetHeight(opts({ showProgress: false }))).toBeLessThan(full);
  });

  it('does not charge for the donor line when the progress block is hidden', () => {
    // The donor count lives inside the progress block. Counting it separately
    // would leave a gap under every widget with progress turned off.
    expect(widgetHeight(opts({ showProgress: false, showDonorCount: true }))).toBe(
      widgetHeight(opts({ showProgress: false, showDonorCount: false })),
    );
  });

  it('stays positive for the smallest possible widget', () => {
    expect(widgetHeight(opts({ showCover: false, showProgress: false, showDonorCount: false }))).toBeGreaterThan(0);
  });
});

describe('embedSnippet', () => {
  it('emits an absolute src — a relative path 404s on the host site', () => {
    const s = embedSnippet('https://www.charitme.com', 'save-the-bees', 'Save the Bees', DEFAULT_WIDGET_OPTIONS);
    expect(s).toContain('src="https://www.charitme.com/campaigns/save-the-bees/embed"');
    expect(s).not.toContain('src="/');
  });

  it('tolerates a trailing slash on the origin without doubling it', () => {
    const s = embedSnippet('https://www.charitme.com/', 'a', 'A', DEFAULT_WIDGET_OPTIONS);
    expect(s).not.toContain('com//campaigns');
  });

  it('escapes the title into the iframe title attribute', () => {
    // Campaign titles are user input and land in an HTML attribute that the
    // fundraiser pastes onto their own site. An unescaped quote would break out
    // of the attribute on a third-party page.
    const s = embedSnippet('https://x.test', 'a', 'Help "Ana" & <b>family</b>', DEFAULT_WIDGET_OPTIONS);
    expect(s).not.toMatch(/title="Help "/);
    expect(s).toContain('&quot;Ana&quot;');
    expect(s).toContain('&amp;');
    expect(s).toContain('&lt;b&gt;');
  });

  it('escapes the ampersands the query itself produces', () => {
    const s = embedSnippet('https://x.test', 'a', 'A', opts({ theme: 'dark', showCover: false }));
    expect(s).toContain('&amp;');
    expect(s).not.toMatch(/embed\?[^"]*[^p];/);
  });

  it('carries the chosen width and the derived height', () => {
    const o = opts({ width: 520, showCover: false });
    const s = embedSnippet('https://x.test', 'a', 'A', o);
    expect(s).toContain('width="520"');
    expect(s).toContain(`height="${widgetHeight(o)}"`);
  });

  it('percent-encodes a slug rather than trusting it', () => {
    expect(widgetPath('a b/c', DEFAULT_WIDGET_OPTIONS)).toBe('/campaigns/a%20b%2Fc/embed');
  });
});
