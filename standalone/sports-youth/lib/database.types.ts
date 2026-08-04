/** Row types matching supabase/schema.sql. Keep in sync by hand, or replace
 *  with `supabase gen types typescript --project-id <ref> > lib/database.types.ts`. */

export type CampaignRow = {
  id: string; owner_id: string | null; slug: string; title: string;
  tagline: string | null; description: string | null; category: string;
  cover_image_url: string | null; goal_amount: number; raised_amount: number;
  backer_count: number; status: 'draft' | 'active' | 'completed' | 'paused';
  visibility: 'public' | 'private' | 'unlisted'; deleted_at: string | null;
  created_at: string;
};

export type CauseStoryRow = {
  id: string; cause_slug: string; title: string; blurb: string | null;
  chip_label: string | null; chip_accent: number; poster_url: string | null;
  video_url: string | null; campaign_id: string | null; sort_order: number;
  published: boolean; published_at: string | null; created_at: string;
};

export type CauseImpactStatRow = {
  id: string; cause_slug: string; value: string; label: string; icon: number;
  sort_order: number; source_note: string | null; published: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      campaigns: { Row: CampaignRow; Insert: Partial<CampaignRow>; Update: Partial<CampaignRow> };
      cause_stories: { Row: CauseStoryRow; Insert: Partial<CauseStoryRow>; Update: Partial<CauseStoryRow> };
      cause_impact_stats: { Row: CauseImpactStatRow; Insert: Partial<CauseImpactStatRow>; Update: Partial<CauseImpactStatRow> };
    };
  };
};
