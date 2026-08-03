import 'server-only';
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import { campaignColumns, applyLiveFilters } from './campaign-visibility';
import { CAUSES } from './causes';

/**
 * Figures for the /causes index: a per-cause campaign count and money raised,
 * plus the four platform tiles at the top of the page.
 *
 * ⚠️ Every number here is MEASURED. The reference design asserts a five-figure
 * active-campaign count, an eight-figure "raised this month", a seven-figure
 * "people helped" and a three-figure country count. Reality is orders of
 * magnitude smaller, and "people helped" is not an entity in this schema at all
 * — donations are. A visitor choosing where to give is exactly the person who
 * must not be handed invented numbers.
 *
 * ⚠️ Reads are BOUNDED and self-reporting. `__tests__/unbounded-reads.test.ts`
 * exists because an unbounded select costs nothing at 500 rows and takes the
 * page down at 500,000 without ever announcing the transition. Sums cannot use
 * a head-only count, so this takes ONE limited read and tallies in JS — and if
 * that read comes back saturated at the limit, the total is refused rather than
 * published short. A quietly understated total is worse than a missing one:
 * nothing on screen says it is wrong.
 */

/** How many rows a single tally read may take before we stop trusting the sum. */
const TALLY_LIMIT = 5000;

export interface CauseFigures {
  /** Live campaigns in this cause. `undefined` when it could not be counted. */
  campaigns?: number;
  /** Money raised across them, in cents. `undefined` when not measurable. */
  raisedCents?: number;
}

export interface CausesIndexData {
  perCause: Map<string, CauseFigures>;
  /** Live campaigns platform-wide. `null` = not measurable, never 0. */
  activeCampaigns: number | null;
  /**
   * Raised across every live campaign, in cents.
   *
   * ⚠️ The reference labels this tile "raised this month". That figure is
   * genuinely $0 right now — no donation carries a timestamp in the current
   * calendar month — and a $0 hero tile on a page asking people to give is
   * true but actively counterproductive. Rather than publish a correct number
   * nobody can act on, the tile shows the all-time total and is LABELLED as
   * such. Relabelling so a tile matches its number is the same call already
   * made on the cause page, where a "Communities" tile was renamed "Countries"
   * once it turned out to be counting `supported_countries`.
   */
  raisedTotalCents: number | null;
  /** Completed donations platform-wide. */
  gifts: number | null;
  /** Countries we can accept a donation in today. */
  countries: number | null;
}

const EMPTY: CausesIndexData = {
  perCause: new Map(),
  activeCampaigns: null,
  raisedTotalCents: null,
  gifts: null,
  countries: null,
};

export async function getCausesIndexData(): Promise<CausesIndexData> {
  try {
    const cols = await campaignColumns();
    const [tally, active, gifts, countries] = await Promise.all([
      // ONE bounded read for every live campaign's category + amount, tallied
      // below. Eighteen head-counts would give the counts but not the sums.
      boundedQuery(() =>
        applyLiveFilters(
          supabaseAdmin.from('campaigns').select('category, raised_amount'),
          cols,
        ).limit(TALLY_LIMIT),
      ),
      boundedQuery(() =>
        applyLiveFilters(
          supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }),
          cols,
        ),
      ),
      boundedQuery(() =>
        supabaseAdmin
          .from('donations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),
      ),
      boundedQuery(() =>
        supabaseAdmin
          .from('supported_countries')
          .select('id', { count: 'exact', head: true })
          .eq('active', true)
          .eq('can_donate', true),
      ),
    ]);

    const perCause = new Map<string, CauseFigures>();
    const rows = tally.error ? null : (tally.data ?? []);
    // Saturated means there may be more rows we did not see, so every derived
    // total would be short. Refuse rather than understate.
    const tallyUsable = rows !== null && rows.length < TALLY_LIMIT;

    if (tallyUsable) {
      const byCategory = new Map<string, { n: number; cents: number }>();
      for (const r of rows) {
        const key = (r.category as string | null) ?? '';
        const acc = byCategory.get(key) ?? { n: 0, cents: 0 };
        acc.n += 1;
        acc.cents += Number(r.raised_amount ?? 0);
        byCategory.set(key, acc);
      }
      for (const cause of CAUSES) {
        let n = 0;
        let cents = 0;
        for (const cat of cause.categories) {
          const acc = byCategory.get(cat);
          if (acc) { n += acc.n; cents += acc.cents; }
        }
        perCause.set(cause.slug, { campaigns: n, raisedCents: cents });
      }
    }

    return {
      perCause,
      activeCampaigns: active.error ? null : active.count ?? 0,
      // The same bounded tally the per-cause figures come from, so the platform
      // total and the cards can never disagree.
      raisedTotalCents: tallyUsable
        ? rows.reduce((sum, r) => sum + Number(r.raised_amount ?? 0), 0)
        : null,
      gifts: gifts.error ? null : gifts.count ?? 0,
      countries: countries.error ? null : countries.count ?? 0,
    };
  } catch {
    // Never throw from a page loader: a cold build with Supabase unreachable
    // otherwise 500s the whole route. Every field is null/empty, which renders
    // as an em-dash rather than a confident zero.
    return EMPTY;
  }
}
