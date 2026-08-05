/**
 * Hand-written row types for the tables this app's cause pages read.
 *
 * ⚠️ NOT a full generated `Database` type. `supabaseAdmin` is constructed
 * without a schema generic, so PostgREST responses arrive loosely typed and
 * every reader casts field by field — which is how a renamed column becomes a
 * runtime `undefined` instead of a compile error.
 *
 * Generating the complete type (`supabase gen types typescript`) needs a live
 * project and would cover all 162 tables; that is the right eventual fix. These
 * cover the two tables added for the cause landing design, so their readers are
 * checked today rather than never.
 *
 * Keep in sync with:
 *   supabase/migrations/20260824000000_cause_stories.sql
 *   supabase/migrations/20260825000000_cause_impact_stats.sql
 */

/** A row of `public.cause_stories`. */
export interface CauseStoryRow {
  id: string;
  cause_slug: string;
  title: string;
  blurb: string | null;
  chip_label: string | null;
  /** 0-2, selecting the chip accent. Constrained in the database. */
  chip_accent: number;
  poster_url: string | null;
  /**
   * `null` means no video, and the card renders as a read link rather than
   * showing a play control that would start nothing.
   */
  video_url: string | null;
  campaign_id: string | null;
  sort_order: number;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A row of `public.cause_impact_stats`. */
export interface CauseImpactStatRow {
  id: string;
  cause_slug: string;
  /** Display string ("125K+"), not a quantity — see the migration's note. */
  value: string;
  label: string;
  /** 0-3, selecting which glyph sits above the figure. */
  icon: number;
  sort_order: number;
  /** Where the published claim comes from. Admin-facing, never rendered. */
  source_note: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

/** The embedded campaign PostgREST returns for `campaigns:campaign_id(slug)`. */
export type EmbeddedCampaignSlug = { slug?: string } | null;
