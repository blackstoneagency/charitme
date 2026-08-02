import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from './supabase';
import { sortForDisplay, type GivingDayPhase, givingDayPhase } from './giving-days-core';

/**
 * Reads for `giving_days`, the table that had neither a reader nor a writer.
 *
 * Everything here goes through `supabaseAdmin` because the table's only policy
 * is `giving_days_owner_write` — there is no public SELECT, so an anon client
 * sees zero rows. That makes the service-role client the only way to render a
 * public page, and it means **RLS is not enforcing anything on this path**: the
 * queries below must not select a column a visitor should not see, and the
 * ownership check for writes lives in `canManageGivingDay`.
 *
 * Every loader returns `null` on failure and `[]` on genuinely-empty. A public
 * page that 500s because the database is unreachable is worse than one that
 * says it has nothing to show, and the two must not be rendered the same way —
 * "no giving days are running" is a fact, not an error.
 */

export type GivingDayRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  goal_amount: number | null;
  nonprofit_id: string | null;
};

export type GivingDay = GivingDayRow & {
  phase: GivingDayPhase;
  nonprofitName: string | null;
  nonprofitSlug: string | null;
  raisedCents: number;
};

const COLUMNS = 'id, slug, title, starts_at, ends_at, goal_amount, nonprofit_id';

/** `null` means the read FAILED — distinct from an empty list. */
export const listGivingDays = cache(async function listGivingDays(limit = 60): Promise<GivingDay[] | null> {
  const { data, error } = await supabaseAdmin
    .from('giving_days')
    .select(COLUMNS)
    .order('starts_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[giving-days] list unavailable', { code: error.code });
    return null;
  }
  return decorate((data ?? []) as GivingDayRow[]);
});

export const getGivingDay = cache(async function getGivingDay(slug: string): Promise<GivingDay | null> {
  const { data, error } = await supabaseAdmin
    .from('giving_days')
    .select(COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  const [decorated] = await decorate([data as GivingDayRow]);
  return decorated ?? null;
});

/**
 * Nonprofit names and raised totals in two batched queries rather than one per
 * row. A list of 60 giving days would otherwise issue 120 round trips, which is
 * how a page that renders instantly in development takes eight seconds in
 * production.
 */
async function decorate(rows: GivingDayRow[]): Promise<GivingDay[]> {
  if (rows.length === 0) return [];

  const nonprofitIds = [...new Set(rows.map((r) => r.nonprofit_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, { name: string; slug: string; ownerId: string }>();
  if (nonprofitIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('nonprofit_profiles')
      .select('id, name, slug, owner_id')
      .in('id', nonprofitIds);
    for (const np of data ?? []) {
      names.set(np.id as string, {
        name: np.name as string,
        slug: np.slug as string,
        ownerId: np.owner_id as string,
      });
    }
  }

  // Money raised during the window, per giving day.
  //
  // Donations carry no giving-day column — the event is a TIME BOX over a
  // nonprofit's campaigns — so this sums completed donations inside the window.
  //
  // ⚠️ `campaigns` has no `nonprofit_id`. It links to a person (`user_id`), and
  // `nonprofit_profiles` names that person as `owner_id`, so a nonprofit's
  // campaigns are the ones its owner created. Querying `campaigns.nonprofit_id`
  // would have failed with PostgREST 42703 against a column that does not exist.
  const raised = new Map<string, number>();
  await Promise.all(rows.map(async (row) => {
    const owner = row.nonprofit_id ? names.get(row.nonprofit_id)?.ownerId : null;
    if (!owner) { raised.set(row.id, 0); return; }
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', owner)
      .limit(200);
    const ids = (campaigns ?? []).map((c) => c.id as string);
    if (ids.length === 0) { raised.set(row.id, 0); return; }
    const { data: donations } = await supabaseAdmin
      .from('donations')
      .select('amount_cents')
      .in('campaign_id', ids)
      .eq('status', 'completed')
      .gte('created_at', row.starts_at)
      .lt('created_at', row.ends_at)
      .limit(5000);
    raised.set(row.id, (donations ?? []).reduce((sum, d) => sum + Number(d.amount_cents ?? 0), 0));
  }));

  const decorated = rows.map((row) => {
    const np = row.nonprofit_id ? names.get(row.nonprofit_id) : undefined;
    return {
      ...row,
      phase: givingDayPhase({ startsAt: row.starts_at, endsAt: row.ends_at }),
      nonprofitName: np?.name ?? null,
      nonprofitSlug: np?.slug ?? null,
      raisedCents: raised.get(row.id) ?? 0,
    };
  });

  return sortForDisplay(
    decorated.map((d) => ({ ...d, startsAt: d.starts_at, endsAt: d.ends_at })),
  ).map(({ startsAt: _s, endsAt: _e, ...rest }) => rest) as GivingDay[];
}

/** The nonprofit profiles this user owns — the input to `canManageGivingDay`. */
export async function ownedNonprofitIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('nonprofit_profiles')
    .select('id')
    .eq('owner_id', userId);
  if (error) return [];
  return (data ?? []).map((r) => r.id as string);
}

/** Giving days this user may manage, for the dashboard. `null` on failure. */
export async function listManageableGivingDays(userId: string, isAdmin: boolean): Promise<GivingDay[] | null> {
  const owned = await ownedNonprofitIds(userId);
  if (!isAdmin && owned.length === 0) return [];

  let query = supabaseAdmin.from('giving_days').select(COLUMNS).order('starts_at', { ascending: false }).limit(100);
  if (!isAdmin) query = query.in('nonprofit_id', owned);

  const { data, error } = await query;
  if (error) {
    console.warn('[giving-days] manage list unavailable', { code: error.code });
    return null;
  }
  return decorate((data ?? []) as GivingDayRow[]);
}
