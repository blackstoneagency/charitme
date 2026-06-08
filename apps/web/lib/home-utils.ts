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
  return (value ?? '').replace(/[^a-zA-Z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
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
