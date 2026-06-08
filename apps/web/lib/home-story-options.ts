import type { StoryFilterValue, StorySortValue } from './home-types';

export const STORY_FILTERS: Array<{ label: string; value: StoryFilterValue; icon: string }> = [
  { label: 'All Stories', value: '', icon: 'grid' },
  { label: 'Individuals', value: 'individuals', icon: 'user' },
  { label: 'Nonprofits', value: 'nonprofits', icon: 'building' },
  { label: 'Communities', value: 'community', icon: 'users' },
  { label: 'Emergencies', value: 'emergency', icon: 'bell' },
];

export const STORY_SORTS: Array<{ label: string; value: StorySortValue }> = [
  { label: 'Latest', value: 'latest' },
  { label: 'Most Raised', value: 'raised' },
  { label: 'Most Donors', value: 'donors' },
];
