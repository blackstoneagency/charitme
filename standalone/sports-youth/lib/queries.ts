import 'server-only';
import { createClient } from './supabase-server';
import type { CampaignRow, CauseStoryRow, CauseImpactStatRow } from './database.types';

/** Sports & Youth draws from two campaign categories. */
export const CAUSE_SLUG = 'sports-youth';
export const CAUSE_CATEGORIES = ['Sports', 'Competition'] as const;

/** A read that failed. `null` is never conflated with "empty" — the page tells
 *  a visitor "we could not load these", which is a different claim from "there
 *  are none". */
export type Result<T> = { data: T; error: false } | { data: null; error: true };

export type Campaign = Pick<CampaignRow,
  'id' | 'slug' | 'title' | 'tagline' | 'category' | 'cover_image_url' |
  'goal_amount' | 'raised_amount' | 'backer_count'>;

export async function getCampaigns(limit = 3): Promise<Result<Campaign[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, slug, title, tagline, category, cover_image_url, goal_amount, raised_amount, backer_count')
      .in('category', CAUSE_CATEGORIES as unknown as string[])
      .eq('status', 'active')
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .order('raised_amount', { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: true };
    return { data: (data ?? []) as Campaign[], error: false };
  } catch {
    return { data: null, error: true };
  }
}

export type Story = Pick<CauseStoryRow,
  'id' | 'title' | 'blurb' | 'chip_label' | 'chip_accent' | 'poster_url' | 'video_url'>;

export async function getStories(limit = 3): Promise<Result<Story[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cause_stories')
      .select('id, title, blurb, chip_label, chip_accent, poster_url, video_url')
      .eq('cause_slug', CAUSE_SLUG)
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .limit(limit);
    if (error) return { data: null, error: true };
    return { data: (data ?? []) as Story[], error: false };
  } catch {
    return { data: null, error: true };
  }
}

export type Stat = { value: string; label: string };

/**
 * The four figures in the impact band.
 *
 * Authored rows win. When none are published the band shows MEASURED counts,
 * so an unseeded deployment states something true rather than something
 * invented. A partial set is ignored: mixing an authored claim with a live
 * count in one row would give both the same apparent provenance.
 */
export async function getImpactStats(): Promise<Stat[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('cause_impact_stats')
      .select('value, label, sort_order')
      .eq('cause_slug', CAUSE_SLUG)
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .limit(4);

    const authored = (data ?? []) as Pick<CauseImpactStatRow, 'value' | 'label'>[];
    if (authored.length === 4) return authored.map((r) => ({ value: r.value, label: r.label }));

    const { data: rows } = await supabase
      .from('campaigns')
      .select('raised_amount, backer_count')
      .in('category', CAUSE_CATEGORIES as unknown as string[])
      .eq('status', 'active')
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .limit(2000);

    const live = (rows ?? []) as Pick<CampaignRow, 'raised_amount' | 'backer_count'>[];
    const raised = live.reduce((n, r) => n + Number(r.raised_amount ?? 0), 0);
    const backers = live.reduce((n, r) => n + Number(r.backer_count ?? 0), 0);
    return [
      { value: compact(live.length), label: 'Live campaigns' },
      { value: `$${compact(Math.round(raised / 100))}`, label: 'Raised together' },
      { value: compact(backers), label: 'Supporters' },
      { value: '0%', label: 'Platform fee' },
    ];
  } catch {
    // An em dash, never a zero: "we could not count" and "there are none" are
    // opposite claims and must not render identically.
    return [
      { value: '—', label: 'Live campaigns' },
      { value: '—', label: 'Raised together' },
      { value: '—', label: 'Supporters' },
      { value: '0%', label: 'Platform fee' },
    ];
  }
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString('en-US');
}

export const money = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString('en-US')}`;

export const pct = (raised: number, goal: number) =>
  goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
