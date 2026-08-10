import { describe, expect, it } from 'vitest';
// Plain ESM helper shared with the assigner script — TS resolves it via allowJs.
import { isGeneratedCover, planAssignments, planIsDistinct } from '../scripts/lib/campaign-photo-plan.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// The claim under test is the one the goal turns on: EVERY campaign gets a
// DIFFERENT photo. It is asserted at the real shape of production — 501
// campaigns needing a photo across 18 categories, including the three
// 73-campaign categories that broke the per-campaign hash — so a pass here means
// the property holds at the size it actually has to hold at, not on a toy
// fixture.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The measured live distribution of campaigns NEEDING a photo: 501 across 18
 * categories. Production holds 502 campaigns; the 502nd already carries a real
 * organizer upload and is deliberately excluded from assignment.
 *
 * ⚠️ This said 502 first, and the "reproduces the live population" assertion
 * below caught it — the sizes sum to 501. That guard exists precisely so a
 * mis-stated population cannot make every number under it meaningless.
 */
const LIVE_CATEGORY_SIZES: Record<string, number> = {
  Medical: 73, Education: 73, Faith: 73, Emergency: 23, Community: 22,
  Creative: 22, Sports: 22, Environment: 22, Volunteer: 21, Nonprofit: 18,
  Family: 18, Memorial: 17, Event: 17, Animal: 17, Competition: 16,
  Travel: 16, Business: 16, Wishes: 15,
};

function liveCampaigns() {
  const out: { id: string; slug: string; category: string; cover_image_url: string }[] = [];
  let n = 0;
  for (const [category, size] of Object.entries(LIVE_CATEGORY_SIZES)) {
    for (let i = 0; i < size; i++) {
      n++;
      out.push({
        id: `id-${n}`,
        slug: `campaign-${n}`,
        category,
        cover_image_url: `/media/subject?category=${category}&key=migration-${n}`,
      });
    }
  }
  return out;
}

/** What `poolFor` returns for a category: ceil(need/30)+1 pages of 30. */
function pool(category: string, need: number) {
  const size = (Math.ceil(need / 30) + 1) * 30;
  return Array.from({ length: size }, (_, i) => ({
    id: `${category}-${i}`,
    url: `https://images.unsplash.com/photo-${category}-${i}?w=800`,
    author: 'Photographer',
  }));
}

describe('every campaign gets a different photo, at production scale', () => {
  const campaigns = liveCampaigns();

  it('reproduces the live population', () => {
    // Guards the guard: if this drifts from 501 the numbers below stop meaning
    // what they say. It has already earned its place once — see the note above.
    expect(campaigns.length).toBe(501);
    expect(new Set(campaigns.map((c) => c.category)).size).toBe(18);
  });

  it('assigns 501 campaigns 501 distinct photos', () => {
    const pools = new Map(
      Object.entries(LIVE_CATEGORY_SIZES).map(([cat, n]) => [cat, pool(cat, n)]),
    );
    const { assignments, shortfall } = planAssignments(campaigns, pools);

    expect(shortfall).toEqual([]);
    expect(assignments.length).toBe(501);
    expect(planIsDistinct(assignments)).toBe(true);
    expect(new Set(assignments.map((a: { photo: { url: string } }) => a.photo.url)).size).toBe(501);
  });

  it('is stable across runs, so a re-run does not reshuffle the site', () => {
    const pools = new Map(
      Object.entries(LIVE_CATEGORY_SIZES).map(([cat, n]) => [cat, pool(cat, n)]),
    );
    const first = planAssignments(campaigns, pools).assignments;
    const second = planAssignments(campaigns, pools).assignments;
    expect(second.map((a: { photo: { url: string } }) => a.photo.url))
      .toEqual(first.map((a: { photo: { url: string } }) => a.photo.url));
  });

  it('keeps every photo inside its own category, so covers stay on-theme', () => {
    const pools = new Map(
      Object.entries(LIVE_CATEGORY_SIZES).map(([cat, n]) => [cat, pool(cat, n)]),
    );
    const { assignments } = planAssignments(campaigns, pools);
    for (const a of assignments as { campaign: { category: string }; photo: { id: string } }[]) {
      expect(a.photo.id.startsWith(a.campaign.category)).toBe(true);
    }
  });
});

describe('a category short of photos produces NO assignments for it', () => {
  it('reports the shortfall instead of assigning a partial set', () => {
    // The dangerous alternative is assigning the first N and leaving the rest —
    // a run that looks successful and leaves duplicates behind.
    const campaigns = Array.from({ length: 40 }, (_, i) => ({
      id: `id-${i}`, slug: `c-${i}`, category: 'Medical', cover_image_url: null,
    }));
    const pools = new Map([['Medical', pool('Medical', 40).slice(0, 10)]]);
    const { assignments, shortfall } = planAssignments(campaigns, pools);

    expect(assignments).toEqual([]);
    expect(shortfall).toEqual([{ category: 'Medical', campaigns: 40, photos: 10 }]);
  });

  it('does not let one short category block the others', () => {
    const campaigns = [
      ...Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, slug: `m${i}`, category: 'Medical', cover_image_url: null })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, slug: `a${i}`, category: 'Animal', cover_image_url: null })),
    ];
    const pools = new Map([
      ['Medical', pool('Medical', 40).slice(0, 10)],
      ['Animal', pool('Animal', 5)],
    ]);
    const { assignments, shortfall } = planAssignments(campaigns, pools);
    expect(shortfall.map((s: { category: string }) => s.category)).toEqual(['Medical']);
    expect(assignments.length).toBe(5);
  });
});

describe('generated art is replaceable; a real upload is not', () => {
  it.each([
    [null, true],
    ['', true],
    ['/media/subject?category=Medical&key=x', true],
    ['https://www.charitme.com/media/subject?category=Medical&key=x', true],
    ['https://picsum.photos/id/9/800/600', true],
    ['https://loremflickr.com/800/600/charity', true],
    ['https://yanexccimwooursawynm.supabase.co/storage/v1/object/public/campaign-media/real.jpg', false],
    ['https://images.unsplash.com/photo-123?w=800', false],
  ])('%s → generated=%s', (url, expected) => {
    expect(isGeneratedCover(url as string | null)).toBe(expected);
  });

  it('treats an already-assigned Unsplash cover as real, so re-runs are idempotent', () => {
    // This is what makes --commit safe to run twice: the second run sees the
    // photos the first one wrote and leaves them alone.
    expect(isGeneratedCover('https://images.unsplash.com/photo-abc?auto=format&w=800')).toBe(false);
  });
});
