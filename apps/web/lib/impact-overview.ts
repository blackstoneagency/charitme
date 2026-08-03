import 'server-only';
import { CAUSES, type Cause } from './causes';
import { getCausesIndexData } from './causes-index';
import { PLATFORM_FEE_PERCENT } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// Data for the /impact overview.
//
// The reference design puts five headline figures across the top —
// "2.3M+ People Helped", "68K+ Lives Transformed", "1,250+ Programs Funded",
// "120+ Countries Reached", "98% Funds to Programs" — and a per-area money
// figure on each of six cards.
//
// **Two of those five are not entities in this schema.** Nothing records a
// person "helped" or a life "transformed"; there is no table, column or event
// either could be counted from. Printing them would be inventing a platform
// impact claim, which this repo has already had to retract once (recorded in
// `docs/`) and which `cause-landing.test.ts` exists to prevent.
//
// The other three ARE measurable, and one of them is better than the design:
// the platform fee is **0%**, so 100% of a donation reaches the campaign —
// where the mock claims 98%.
//
// So the strip keeps its five-tile shape and every tile is measured.
// ─────────────────────────────────────────────────────────────────────────────

export interface ImpactArea {
  cause: Cause;
  /** Money raised across this cause's live campaigns. `null` = unmeasurable. */
  raisedCents: number | null;
  /** Live campaigns in it. `null` = unmeasurable. */
  campaigns: number | null;
}

export interface ImpactOverview {
  /** All-time raised across live campaigns. `null` = unmeasurable, never 0. */
  raisedTotalCents: number | null;
  /** Completed donations. */
  gifts: number | null;
  /** Live campaigns. */
  activeCampaigns: number | null;
  /** Countries a donation can be accepted in today. */
  countries: number | null;
  /**
   * Share of a donation that reaches the campaign, as a whole percent.
   *
   * Derived from `PLATFORM_FEE_PERCENT`, not typed in: if the platform ever
   * starts taking a cut, this tile follows it instead of continuing to claim
   * 100%. That is the whole reason it is computed from the constant.
   */
  toCampaignPercent: number;
  /** The six areas carrying the most measured money, most first. */
  areas: ImpactArea[];
}

/** Six, matching the reference's grid. */
const AREA_COUNT = 6;

export async function getImpactOverview(): Promise<ImpactOverview> {
  const data = await getCausesIndexData();

  // "Where your support makes an impact" is answered with the causes where it
  // demonstrably HAS — ranked by measured money, not by an editorial order.
  //
  // A cause whose figure could not be read is excluded rather than sorted as
  // zero: ranking an unmeasured cause last states that nothing was raised in
  // it, which is the `?? 0` mistake this codebase keeps having to undo.
  const areas: ImpactArea[] = CAUSES
    .map((cause) => {
      const figures = data.perCause.get(cause.slug);
      return {
        cause,
        raisedCents: figures?.raisedCents ?? null,
        campaigns: figures?.campaigns ?? null,
      };
    })
    .filter((a) => a.raisedCents !== null && a.raisedCents > 0)
    .sort((a, b) => (b.raisedCents ?? 0) - (a.raisedCents ?? 0))
    .slice(0, AREA_COUNT);

  return {
    raisedTotalCents: data.raisedTotalCents,
    gifts: data.gifts,
    activeCampaigns: data.activeCampaigns,
    countries: data.countries,
    toCampaignPercent: Math.round(100 - PLATFORM_FEE_PERCENT),
    areas,
  };
}

/**
 * Fallback when no cause has a measured, non-zero total — a brand-new platform,
 * or a failed read.
 *
 * Returns the causes that carry a hand-written description in `lib/causes.ts`
 * so the section still shows real, navigable areas, WITHOUT a money figure.
 * The card renders no amount at all rather than "$0 raised", which would read
 * as a fact about the cause instead of about our data.
 */
export function fallbackAreas(): ImpactArea[] {
  return CAUSES.slice(0, AREA_COUNT).map((cause) => ({
    cause,
    raisedCents: null,
    campaigns: null,
  }));
}
