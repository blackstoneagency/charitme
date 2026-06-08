export type StoryFilterValue = '' | 'individuals' | 'nonprofits' | 'community' | 'emergency';
export type StorySortValue = 'latest' | 'raised' | 'donors';

export type StoryFilters = {
  storyCategory?: StoryFilterValue | string;
  storyQ?: string;
  storySort?: StorySortValue | string;
};

export type HomeCampaign = {
  slug: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  category: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  trust_status?: string | null;
  campaign_health_score?: number | null;
  deadline: string | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};
