import 'server-only';
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';

// ─────────────────────────────────────────────────────────────────────────────
// Owner-authored figures for /impact.
//
// The reference design's headline tiles and Funds Distribution donut are not
// derivable from this schema — nothing records "people helped" or "lives
// transformed", and there is no expense ledger behind a spend breakdown. They
// live in `platform_impact_stats` / `platform_fund_allocation` so the owner
// authors them, with a `source_note` recording where each number came from.
//
// ⚠️ EVERY FAILURE MODE RETURNS EMPTY, AND EMPTY MEANS "FALL BACK TO MEASURED".
// The migration may be unapplied (`42P01`), the table may be empty, the rows may
// be unpublished, or the database may be down. None of those should show a
// visitor a broken band, and none should invent a number — so the page keeps
// rendering the figures it can actually compute until an admin publishes.
// ─────────────────────────────────────────────────────────────────────────────

/** Table absent — the migration has not been applied on this deployment. */
const UNDEFINED_TABLE = '42P01';

export interface PlatformStat {
  value: string;
  label: string;
  /** 0 people · 1 heart · 2 gift · 3 globe · 4 leaf — matches the design's icons. */
  icon: number;
}

export interface FundSlice {
  label: string;
  percent: number;
  colorIndex: number;
}

export async function getPublishedImpactStats(): Promise<PlatformStat[]> {
  const { data, error } = await boundedQuery(() => supabaseAdmin
    .from('platform_impact_stats')
    .select('value, label, icon, sort_order')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .limit(5));

  // A missing table is the expected state before the migration is applied, so it
  // is not logged as an error — it is simply "no authored figures yet".
  if (error || !data) return [];
  return data.map((row) => ({
    value: String(row.value ?? ''),
    label: String(row.label ?? ''),
    icon: Number(row.icon ?? 0),
  })).filter((s) => s.value && s.label);
}

export async function getPublishedFundAllocation(): Promise<FundSlice[]> {
  const { data, error } = await boundedQuery(() => supabaseAdmin
    .from('platform_fund_allocation')
    .select('label, percent, color_index, sort_order')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .limit(6));

  if (error || !data) return [];

  const slices = data.map((row) => ({
    label: String(row.label ?? ''),
    percent: Number(row.percent ?? 0),
    colorIndex: Number(row.color_index ?? 0),
  })).filter((s) => s.label && Number.isFinite(s.percent) && s.percent > 0);

  // ⚠️ Refuse a breakdown that does not add up.
  //
  // A donut is read as "this is all of the money". If someone publishes three of
  // four rows, or a set summing to 60%, the chart would draw a confident picture
  // of an incomplete truth — worse than showing nothing, because it looks
  // complete. Tolerance of 1 point absorbs honest rounding of published accounts.
  const total = slices.reduce((sum, s) => sum + s.percent, 0);
  if (slices.length < 2 || Math.abs(total - 100) > 1) return [];

  return slices;
}

export { UNDEFINED_TABLE };
