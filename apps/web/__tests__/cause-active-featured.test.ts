import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notExpiredFilter } from '../lib/campaign-visibility-core';
import { campaignLifecycle } from '../lib/campaign-lifecycle';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Cause pages must show ONLY campaigns that are still running, and must put a
// featured campaign inside the first six rather than leaving it to luck.
//
// The trap this guards is that `status = 'active'` LOOKS like "still running"
// and is not. Nothing in the schema moves a campaign out of `active` when its
// deadline passes — `lib/campaign-lifecycle.ts` derives that at render time,
// which is why a card could read "Ended" while its row still said active and
// still occupied one of the six slots.
//
// So the SQL rule and the render rule are asserted against EACH OTHER below,
// not just each against itself. A grid that pruned rows the card would have
// shown as live would be short for no visible reason; a grid that kept rows the
// card calls "Ended" is the bug being fixed. Both directions are checked.
// ─────────────────────────────────────────────────────────────────────────────

describe('the expiry rule, and the render rule, are the same rule', () => {
  const NOW = new Date('2026-08-05T12:00:00.000Z');

  it('keeps a campaign with no deadline — it runs indefinitely', () => {
    expect(notExpiredFilter(NOW)).toContain('deadline.is.null');
    expect(campaignLifecycle({ status: 'active', deadline: null }, NOW.getTime())).toBe('active');
  });

  it('compares against the moment asked for, not a baked-in date', () => {
    expect(notExpiredFilter(NOW)).toBe('deadline.is.null,deadline.gt.2026-08-05T12:00:00.000Z');
  });

  it('uses `gt`, so a deadline of TODAY is expired in SQL and "Ended" in the card', () => {
    // The one boundary the two halves could disagree on. `campaignDaysLeft`
    // floors at 0 and the lifecycle calls `days <= 0` ended, so `gte` here would
    // keep a campaign in the grid whose own card rendered "Ended".
    expect(notExpiredFilter(NOW)).toContain('deadline.gt.');
    expect(notExpiredFilter(NOW)).not.toContain('deadline.gte.');
    expect(
      campaignLifecycle({ status: 'active', deadline: '2026-08-05' }, NOW.getTime()),
      'a deadline of today has already arrived',
    ).toBe('ended');
  });

  it('keeps a campaign whose deadline is genuinely ahead', () => {
    // The other direction, which matters just as much: over-filtering would
    // empty cause pages and read as "this cause has no campaigns".
    expect(campaignLifecycle({ status: 'active', deadline: '2026-09-05' }, NOW.getTime())).toBe('active');
    // …and SQL keeps it, because 2026-09-05 > the timestamp in the filter.
    const bound = notExpiredFilter(NOW).split('deadline.gt.')[1];
    expect(new Date('2026-09-05').getTime()).toBeGreaterThan(new Date(bound).getTime());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The API half. Pages 2+ of a cause grid come from /api/campaigns, so the filter
// and the ordering have to be applied THERE too — a rule enforced only on the
// server-rendered first page would let expired campaigns back in on the second
// click, and a different sort either side of the page boundary duplicates some
// rows and skips others.
//
// This executes the route against a recording chain rather than reading its
// source, so it fails if the filter is moved somewhere it does not run.
// ─────────────────────────────────────────────────────────────────────────────

interface Applied {
  or: string[];
  order: [string, boolean][];
  eq: [string, unknown][];
  in: [string, unknown][];
}

let applied: Applied;

function recorder() {
  const target: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return t.then;
      if (typeof prop === 'symbol') return undefined;
      return (...args: unknown[]) => {
        if (prop === 'or') applied.or.push(String(args[0]));
        if (prop === 'order') {
          applied.order.push([
            String(args[0]),
            (args[1] as { ascending?: boolean } | undefined)?.ascending !== false,
          ]);
        }
        if (prop === 'eq') applied.eq.push([String(args[0]), args[1]]);
        if (prop === 'in') applied.in.push([String(args[0]), args[1]]);
        return recorder();
      };
    },
  });
}

vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from: () => recorder() } }));

beforeEach(() => {
  vi.resetModules();
  applied = { or: [], order: [], eq: [], in: [] };
});

function get(qs: string) {
  return new Request(`http://localhost/api/campaigns?${qs}`) as never;
}

describe('/api/campaigns serves the same rule the cause page renders', () => {
  it('excludes expired campaigns', async () => {
    const { GET } = await import('../app/api/campaigns/route');
    await GET(get('category=Sports&limit=6'));

    const expiry = applied.or.find((f) => f.startsWith('deadline.is.null'));
    expect(expiry, 'page 2 of a cause grid must not reintroduce ended campaigns').toBeDefined();
    expect(expiry).toContain('deadline.gt.');
  });

  it('still applies the filters that were already there', async () => {
    // Guards the guard: the new `.or()` must be ADDED to the live filters, not
    // substituted for them. Dropping `deleted_at`/`visibility` here would list
    // soft-deleted and private campaigns.
    const { GET } = await import('../app/api/campaigns/route');
    await GET(get('category=Sports&limit=6'));

    expect(applied.eq).toContainEqual(['status', 'active']);
    expect(applied.eq).toContainEqual(['visibility', 'public']);
  });

  it('orders featured first when the cause grid asks for it', async () => {
    const { GET } = await import('../app/api/campaigns/route');
    await GET(get('category=Sports&limit=6&sort=raised&featured_first=1'));

    expect(applied.order[0], 'featured must be the FIRST sort key or it decides nothing')
      .toEqual(['featured', false]);
    expect(applied.order[1]).toEqual(['raised_amount', false]);
  });

  it('leaves other callers alone — `sort=newest` stays newest-first', async () => {
    // The opposite direction. Floating featured rows to the top of every listing
    // would silently stop `newest` being newest, which is why the flag is opt-in.
    const { GET } = await import('../app/api/campaigns/route');
    await GET(get('limit=6&sort=newest'));

    expect(applied.order[0]).toEqual(['created_at', false]);
    expect(applied.order.some(([col]) => col === 'featured')).toBe(false);
  });

  it('returns `featured`, so a loaded card can be marked like a rendered one', async () => {
    const api = read('app/api/campaigns/route.ts');
    expect(api).toMatch(/select\('[^']*featured/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The rendering half. Source-level, and that limit is worth naming: this repo
// cannot render a component in a test (`vitest.config.ts` collects
// `__tests__/**/*.test.ts`, and importing a `.tsx` fails to transform because
// Next sets `jsx: 'preserve'`). So these assert the wiring, not the pixels.
// ─────────────────────────────────────────────────────────────────────────────

describe('the cause page asks for, and marks, featured campaigns', () => {
  const page = read('app/causes/[slug]/page.tsx');
  const list = read('app/causes/[slug]/CauseCampaignList.tsx');
  const card = read('components/CampaignCard.tsx');
  const css = read('app/globals.css');

  it('filters expired campaigns out of the server-rendered first six', () => {
    expect(page).toMatch(/applyNotExpired\(/);
  });

  it('selects `featured` and sorts on it BEFORE raised_amount', () => {
    expect(page).toMatch(/select\(\s*'[^']*featured/);
    expect(
      page,
      'featured must be the first sort key, or it cannot put anything in the top six',
    ).toMatch(/\.order\('featured', \{ ascending: false \}\)\s*\n\s*\.order\('raised_amount'/);
  });

  it('asks the API for the SAME ordering across the page boundary', () => {
    expect(list).toMatch(/featured_first: '1'/);
  });

  it('marks a featured card for people who cannot see a ring', () => {
    // A border colour alone is decoration a screen-reader user never receives.
    expect(card).toMatch(/isFeatured && <Badge color="green">★ Featured<\/Badge>/);
  });

  it('never infers featured from position', () => {
    // `c.featured === true`, not truthiness: most listings do not select the
    // column, and `undefined` means "not known", which must render as ordinary.
    //
    // Matched loosely at the end so the per-page cap can AND itself on
    // (`&& highlightFeatured`) without this having to be rewritten — but the
    // `=== true` comparison itself is still pinned, which is the whole point.
    expect(card).toMatch(/const isFeatured = c\.featured === true\b/);
    expect(card, 'truthiness would highlight every card on a listing that omits the column')
      .not.toMatch(/const isFeatured = (!!|Boolean\()c\.featured/);
  });

  it('styles the highlight with tokens, so it reads in both themes', () => {
    const block = css.slice(css.indexOf('.cc-feature--promoted {'));
    const rule = block.slice(0, block.indexOf('}'));
    expect(rule).toMatch(/var\(--green\)/);
    expect(
      rule.match(/#[0-9a-fA-F]{3,8}/),
      'a hardcoded colour here is the muted-slate regression again',
    ).toBeNull();
  });

  it('survives forced colours, where box-shadow is dropped entirely', () => {
    expect(css).toMatch(/@media \(forced-colors: active\) \{\s*\.cc-feature--promoted \{[^}]*outline:/);
  });
});

describe('the cause stats tile counts what the grid shows', () => {
  it('excludes expired campaigns from "Live campaigns"', () => {
    // The tile sits directly above the grid. Counting a campaign the grid
    // refuses to show makes the two disagree, and the grid is the checkable half.
    expect(read('lib/cause-landing.ts')).toMatch(/applyNotExpired\(/);
  });

  it('still shows COMPLETED campaigns as stories, which is a different question', () => {
    // Guards the guard: "Stories from the Field" is deliberately built from
    // finished campaigns. A blanket expiry sweep would have emptied it.
    expect(read('lib/cause-landing.ts')).toMatch(/\.eq\('status', 'completed'\)/);
  });
});
