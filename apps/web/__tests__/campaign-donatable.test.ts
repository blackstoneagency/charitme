import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// A campaign may only appear in DISCOVERY if it can actually take a donation.
//
// `status = 'active'` and an unexpired deadline mean the campaign is RUNNING.
// They say nothing about whether money can reach anyone: a Stripe destination
// charge needs a verified, fully-onboarded connected account belonging to the
// beneficiary or the organizer. Without one the campaign's own page renders
// "Donations open soon" — while the same campaign sat in cause grids looking
// exactly like one you could give to.
//
// Measured on production 2026-08-09: 4 of 26 sampled live campaigns (~15%) were
// in that state, and 3 of those 4 came from the `sort=newest` page — new
// organizers who have not finished Stripe onboarding.
// ─────────────────────────────────────────────────────────────────────────────

describe('the donatable filter is opt-in and column-guarded', () => {
  const src = read('lib/campaign-visibility.ts');

  it('no-ops when the column has not been migrated yet', () => {
    // The migration is applied by the OWNER, not by deploy. Between this code
    // shipping and that SQL running, `payout_ready` does not exist — and
    // filtering on a missing column is Postgres 42703, which fails the entire
    // query. Every discovery page on the site would render empty.
    expect(src).toMatch(/if \(!cols\.payoutReady\) return query;/);
  });

  it('filters on the stored column rather than joining', () => {
    expect(src).toMatch(/\.eq\('payout_ready'/);
  });

  it('is a SEPARATE helper from applyLiveFilters', () => {
    // Folding it in would hide payout-pending campaigns from the organizer's own
    // dashboard, the admin console and the ledger — the exact surfaces where
    // someone needs to SEE the problem to fix it. A fundraiser whose campaign
    // vanished from their own dashboard concludes it was deleted.
    expect(src).toMatch(/export function applyDonatable</);
    const live = src.slice(src.indexOf('export function applyLiveFilters<'));
    const body = live.slice(0, live.indexOf('\n}'));
    expect(body, 'applyLiveFilters must not silently apply the payout filter')
      .not.toMatch(/payout_ready|applyDonatable/);
  });
});

describe('every discovery surface applies it — and the ones that must NOT, do not', () => {
  it.each([
    ['app/causes/[slug]/page.tsx', 'the cause grid'],
    ['app/campaigns/(list)/page.tsx', 'the browse page'],
    ['lib/cause-landing.ts', 'the cause stats tile'],
    ['app/api/campaigns/route.ts', 'pages 2+ of both grids'],
  ])('%s applies applyDonatable (%s)', (path) => {
    expect(read(path)).toMatch(/applyDonatable\(/);
  });

  it('the stats tile counts exactly what the grid shows', () => {
    // Both must filter, or the "Live campaigns" number disagrees with the cards
    // directly beneath it. That disagreement is the defect the expiry filter was
    // added to fix; adding a filter to only one of them recreates it.
    const grid = read('app/causes/[slug]/page.tsx');
    const tile = read('lib/cause-landing.ts');
    for (const [src, name] of [[grid, 'grid'], [tile, 'tile']] as const) {
      expect(src.includes('applyNotExpired('), `${name} expiry`).toBe(true);
      expect(src.includes('applyDonatable('), `${name} donatable`).toBe(true);
    }
  });

  it('the campaign DETAIL page still renders a payout-pending campaign', () => {
    // Hiding it from discovery is right; 404ing the page a donor already has a
    // link to is not. The page explains the state instead — and that copy is
    // what makes the whole feature legible.
    const detail = read('app/campaigns/[slug]/(detail)/page.tsx');
    expect(detail).toMatch(/Donations open soon/);
    expect(detail, 'the detail page must not filter itself out')
      .not.toMatch(/applyDonatable\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The API half, executed rather than read: the filter has to actually run
// BEFORE `.range()` and the `count: 'exact'`, or pagination returns short pages
// and a total that disagrees with the rows shown.
// ─────────────────────────────────────────────────────────────────────────────

interface Applied { eq: [string, unknown][]; or: string[]; order: string[] }
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
        if (prop === 'eq') applied.eq.push([String(args[0]), args[1]]);
        if (prop === 'or') applied.or.push(String(args[0]));
        if (prop === 'order') applied.order.push(String(args[0]));
        return recorder();
      };
    },
  });
}

vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from: () => recorder() } }));

const columns = vi.hoisted(() => ({ value: { visibility: true, deletedAt: true, payoutReady: true } }));
vi.mock('../lib/campaign-visibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/campaign-visibility')>();
  return { ...actual, campaignColumns: async () => columns.value };
});

beforeEach(() => {
  vi.resetModules();
  applied = { eq: [], or: [], order: [] };
  columns.value = { visibility: true, deletedAt: true, payoutReady: true };
});

const get = (qs = '') => new Request(`http://localhost/api/campaigns?${qs}`) as never;

describe('/api/campaigns excludes campaigns that cannot take a donation', () => {
  it('applies the payout filter when the column exists', async () => {
    const { GET } = await import('../app/api/campaigns/route');
    await GET(get('limit=6'));
    expect(applied.eq).toContainEqual(['payout_ready', 'true']);
  });

  it('does NOT apply it when the column is absent', async () => {
    // The direction that matters most: a 42703 here empties the whole API.
    columns.value = { visibility: true, deletedAt: true, payoutReady: false };
    const { GET } = await import('../app/api/campaigns/route');
    await GET(get('limit=6'));
    expect(applied.eq.some(([c]) => c === 'payout_ready')).toBe(false);
    // …while every pre-existing filter is untouched, so nothing else regresses.
    expect(applied.eq).toContainEqual(['status', 'active']);
    expect(applied.eq).toContainEqual(['visibility', 'public']);
  });

  it('keeps the filters it already had', async () => {
    const { GET } = await import('../app/api/campaigns/route');
    await GET(get('limit=6'));
    expect(applied.eq).toContainEqual(['status', 'active']);
    expect(applied.eq).toContainEqual(['visibility', 'public']);
    expect(applied.or.some((f) => f.startsWith('deadline.is.null'))).toBe(true);
  });
});
