import 'server-only';
import { supabaseAdmin } from './supabase';
import { campaignColumns, applyLiveFilters } from './campaign-visibility';
import { boundedQuery } from './query-timeout';
import { campaignDaysLeft, campaignTimeLabel } from './campaign-lifecycle';

// ─────────────────────────────────────────────────────────────────────────────
// "Current needs" — what is still unfunded, right now.
//
// The reference design shows a list of supply lines: "Clean Water Filters —
// $23,450 needed — Urgent", "Food Supplies — $15,200 — High", and so on.
//
// **There is no needs table, and no line-item data anywhere in this schema.**
// A campaign records a goal and an amount raised; it does not record that the
// money buys water filters. So the itemised version of this page could only be
// produced by inventing both the items and their prices, and presenting them as
// things communities have asked for. That is not a design detail to approximate
// — it is a claim about what people need.
//
// What IS real, and is what this computes: the funding GAP. `goal_amount -
// raised_amount` on a live campaign is exactly "still needed", measured, per
// campaign. Urgency is derived the same way rather than asserted — from how
// little time is left and how much of the goal is still open.
//
// If a needs/line-item table is added later, this module is where it plugs in.
// ─────────────────────────────────────────────────────────────────────────────

/** Ordered most to least pressing. */
export type Urgency = 'urgent' | 'high' | 'medium';

export interface Need {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  location: string | null;
  coverUrl: string | null;
  goalCents: number;
  raisedCents: number;
  /** `goal - raised`, floored at 0. The actual "still needed" figure. */
  gapCents: number;
  /** Whole percent funded, 0–100. */
  fundedPct: number;
  /** `null` when the campaign has no deadline — not "0 days left". */
  daysLeft: number | null;
  /**
   * The countdown as RENDERED. Produced by the shared `campaignTimeLabel` so
   * this page cannot disagree with a campaign card about the same campaign —
   * `__tests__/campaign-lifecycle.test.ts` refuses a surface that formats its
   * own, which is how "3 days left" and "Ended" once appeared side by side.
   */
  timeLabel: string;
  urgency: Urgency;
}

const SELECT =
  'id, slug, title, category, location, cover_image_url, goal_amount, raised_amount, deadline';

/**
 * Urgency from measured facts only.
 *
 *   urgent — a deadline inside a week with the goal not yet met
 *   high   — a deadline inside a month, or less than a quarter funded
 *   medium — everything else still open
 *
 * Deliberately NOT a score blended from engagement or recency: a donor reads
 * "Urgent" as a statement about the campaign's deadline and shortfall, so those
 * are the only two inputs. A campaign with no deadline can never be "urgent"
 * here, because nothing about it is time-bound.
 */
export function urgencyFor(fundedPct: number, daysLeft: number | null): Urgency {
  const unmet = fundedPct < 100;
  if (daysLeft !== null && daysLeft <= 7 && unmet) return 'urgent';
  if ((daysLeft !== null && daysLeft <= 30 && unmet) || fundedPct < 25) return 'high';
  return 'medium';
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
};

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, high: 1, medium: 2 };

/** `null` means the read FAILED — never conflated with "nothing is needed". */
export async function listCurrentNeeds(opts: { category?: string; limit?: number } = {}): Promise<Need[] | null> {
  const limit = opts.limit ?? 24;
  try {
    const cols = await campaignColumns();
    let query = applyLiveFilters(supabaseAdmin.from('campaigns').select(SELECT), cols);
    if (opts.category) query = query.eq('category', opts.category);

    // Bounded: `.eq('status', …)` inside applyLiveFilters selects a large slice
    // of the table, so it does not bound anything on its own. Ordering by
    // raised_amount ascending puts the least-funded first, which is the closest
    // the database can get to "largest gap" without a computed column —
    // the exact gap is then computed per row below.
    const { data, error } = await boundedQuery(() =>
      query.order('raised_amount', { ascending: true }).limit(limit * 4),
    );
    if (error || !data) return null;

    const rows = data as {
      id: string; slug: string; title: string; category: string | null; location: string | null;
      cover_image_url: string | null; goal_amount: number | null; raised_amount: number | null;
      deadline: string | null;
    }[];

    const needs: Need[] = rows
      .map((r) => {
        const goalCents = Number(r.goal_amount ?? 0);
        const raisedCents = Number(r.raised_amount ?? 0);
        const gapCents = Math.max(0, goalCents - raisedCents);
        const fundedPct = goalCents > 0 ? Math.min(100, Math.round((raisedCents / goalCents) * 100)) : 0;
        const daysLeft = campaignDaysLeft(r.deadline);
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          category: r.category,
          location: r.location,
          coverUrl: r.cover_image_url,
          goalCents,
          raisedCents,
          gapCents,
          fundedPct,
          daysLeft,
          timeLabel: campaignTimeLabel({ status: 'active', deadline: r.deadline }),
          urgency: urgencyFor(fundedPct, daysLeft),
        };
      })
      // A fully funded campaign is not a need. It is the opposite of one.
      .filter((n) => n.gapCents > 0)
      .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || b.gapCents - a.gapCents)
      .slice(0, limit);

    return needs;
  } catch {
    return null;
  }
}
