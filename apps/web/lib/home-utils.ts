import type { StoryFilters, StoryFilterValue, StorySortValue } from './home-types';

function normalizeStoryCategory(value: string | undefined): StoryFilterValue {
  if (value === 'individuals' || value === 'nonprofits' || value === 'community' || value === 'emergency') return value;
  return '';
}

function normalizeStorySort(value: string | undefined): StorySortValue {
  if (value === 'raised' || value === 'donors') return value;
  return 'latest';
}

function cleanStorySearch(value: string | undefined): string {
  return (value ?? '').replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function normalizeStoryFilters(filters: StoryFilters): Required<Pick<StoryFilters, 'storyCategory' | 'storyQ' | 'storySort'>> {
  return {
    storyCategory: normalizeStoryCategory(typeof filters.storyCategory === 'string' ? filters.storyCategory : undefined),
    storyQ: cleanStorySearch(typeof filters.storyQ === 'string' ? filters.storyQ : undefined),
    storySort: normalizeStorySort(typeof filters.storySort === 'string' ? filters.storySort : undefined),
  };
}

export function formatHomeCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function shortHomeCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Whether the homepage should print the platform-impact numbers.
 *
 * `loaded` alone is not a sufficient signal. `getHomeData` does not throw when its
 * reads fail — it coalesces each to `[]` and returns a fully-zeroed metrics object —
 * so at the call site a failed load looks exactly like real zeros. Relying on the
 * try/catch alone shipped "Raised on CharitMe $0" onto the homepage of a
 * credential-less build: a false platform statistic in the most prominent place on
 * the site.
 *
 * So an all-zero reading is treated as "no data". Deliberately conservative: if the
 * platform genuinely had zero of everything, "$0 raised / 0 campaigns / 0 donations"
 * is still not a figure worth publishing. Hiding costs a slightly emptier hero;
 * showing costs the truth.
 *
 * `trustAvg` is excluded from the check on purpose — it is an average, so it can be
 * 0 while real data exists, and it can be non-zero on a stale partial read.
 */
export function shouldShowPlatformMetrics(
  metrics: { raisedCents: number; campaigns: number; donations: number },
  loaded: boolean,
): boolean {
  if (!loaded) return false;
  return metrics.raisedCents > 0 || metrics.campaigns > 0 || metrics.donations > 0;
}
