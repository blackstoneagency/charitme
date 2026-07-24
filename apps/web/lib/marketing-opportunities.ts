import 'server-only';
import { supabaseAdmin } from './supabase';
import type { GoalMetric } from './marketing-goals';

// ── Types ────────────────────────────────────────────────────────────────────
export type Effort = 'low' | 'medium' | 'high';
export type OpportunityStatus = 'new' | 'accepted' | 'rejected' | 'deferred' | 'converted' | 'archived';

export interface OpportunityDraft {
  title: string;
  description: string;
  rationale: string;
  evidence: Record<string, number | string>;
  category: string | null;
  geography: string | null;
  audience: string | null;
  target_metric: GoalMetric;
  est_impact_cents: number | null;
  est_starts: number | null;
  confidence: number;      // 0..1
  effort: Effort;
  cost_cents: number | null;
  time_to_value_days: number | null;
  score: number;           // 0..100
  source: 'rule';
  dedupe_key: string;
}

// ── Deterministic scoring ────────────────────────────────────────────────────
// Composite 0..100 priority from projected impact (log-scaled so a few large
// numbers don't dominate), confidence, effort, and urgency. Pure + unit-tested.
const EFFORT_FACTOR: Record<Effort, number> = { low: 1, medium: 0.72, high: 0.48 };

export function scoreOpportunity(input: {
  estImpactCents: number | null;
  confidence: number;        // 0..1
  effort: Effort;
  urgency?: number;          // 0..1, optional boost (e.g. declining trend)
}): number {
  const impact = input.estImpactCents ?? 0;
  // log scale: $0→0, ~$1k→~0.3, ~$10k→~0.5, ~$100k→~0.7, ~$1M→~0.9 (capped 1)
  const impactNorm = impact <= 0 ? 0 : Math.min(1, Math.log10(impact / 100 + 1) / 6);
  const conf = Math.max(0, Math.min(1, input.confidence));
  const effort = EFFORT_FACTOR[input.effort];
  const urgency = Math.max(0, Math.min(1, input.urgency ?? 0));

  // weighted blend, then effort as a multiplier, then a small urgency lift
  const base = 0.55 * impactNorm + 0.45 * conf;
  const score = base * effort * (1 + 0.25 * urgency);
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

// ── Live generator ───────────────────────────────────────────────────────────
// Derives opportunities from real campaign momentum. One bounded query; grouped
// in memory. Every opportunity carries the exact numbers behind it in `evidence`.
interface CampaignRow { category: string | null; status: string; created_at: string; raised_amount: number | null }

const DAY = 86_400_000;

export async function generateOpportunities(): Promise<OpportunityDraft[]> {
  const now = Date.now();
  const win = 30 * DAY;
  const sinceISO = new Date(now - 2 * win).toISOString();

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('category, status, created_at, raised_amount')
    .gte('created_at', sinceISO)
    .neq('status', 'draft')
    .limit(20_000);
  if (error) throw new Error('opportunity generation query failed');

  const rows = (data ?? []) as CampaignRow[];
  const cutoff = now - win;

  interface Agg { recentCount: number; priorCount: number; recentFunds: number; priorFunds: number }
  const byCat = new Map<string, Agg>();
  for (const r of rows) {
    const cat = r.category ?? 'Uncategorized';
    const a = byCat.get(cat) ?? { recentCount: 0, priorCount: 0, recentFunds: 0, priorFunds: 0 };
    const recent = new Date(r.created_at).getTime() >= cutoff;
    if (recent) { a.recentCount++; a.recentFunds += r.raised_amount ?? 0; }
    else { a.priorCount++; a.priorFunds += r.raised_amount ?? 0; }
    byCat.set(cat, a);
  }

  const drafts: OpportunityDraft[] = [];
  for (const [category, a] of byCat) {
    if (a.recentCount + a.priorCount < 3) continue; // too little signal to be honest about
    const avgRaisedRecent = a.recentCount > 0 ? Math.round(a.recentFunds / a.recentCount) : 0;
    const confidence = Math.min(0.9, 0.3 + (a.recentCount + a.priorCount) / 60);

    // Signal 1 — declining starts (urgent recovery)
    if (a.priorCount >= 3 && a.recentCount < a.priorCount * 0.85) {
      const lost = a.priorCount - a.recentCount;
      const estImpact = avgRaisedRecent * lost;
      drafts.push({
        title: `Reverse the decline in ${category} fundraiser starts`,
        description: `${category} fundraiser starts fell from ${a.priorCount} to ${a.recentCount} over the last two 30-day windows. A targeted content + lifecycle push can recover the lost momentum.`,
        rationale: `Starts down ${Math.round((1 - a.recentCount / a.priorCount) * 100)}% month-over-month while this category still averages $${(avgRaisedRecent / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} raised per campaign.`,
        evidence: { recentStarts: a.recentCount, priorStarts: a.priorCount, avgRaisedCents: avgRaisedRecent },
        category, geography: null, audience: null, target_metric: 'fundraiser_starts',
        est_impact_cents: estImpact || null, est_starts: lost || null,
        confidence, effort: 'medium', cost_cents: null, time_to_value_days: 30,
        score: scoreOpportunity({ estImpactCents: estImpact, confidence, effort: 'medium', urgency: 0.8 }),
        source: 'rule', dedupe_key: `cat:${category}:decline`,
      });
      continue;
    }

    // Signal 2 — rising demand (capitalize)
    if (a.recentCount > a.priorCount && a.recentCount >= 3) {
      const growth = a.recentCount - a.priorCount;
      const estImpact = avgRaisedRecent * growth;
      drafts.push({
        title: `Capitalize on rising ${category} demand`,
        description: `${category} fundraiser starts grew from ${a.priorCount} to ${a.recentCount} in the last 30 days. Amplifying this category (SEO hub + social + email) can extend the trend.`,
        rationale: `Starts up ${a.priorCount > 0 ? Math.round((a.recentCount / a.priorCount - 1) * 100) : 100}% month-over-month at $${(avgRaisedRecent / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} average raised per campaign.`,
        evidence: { recentStarts: a.recentCount, priorStarts: a.priorCount, avgRaisedCents: avgRaisedRecent },
        category, geography: null, audience: null, target_metric: 'fundraiser_starts',
        est_impact_cents: estImpact || null, est_starts: growth || null,
        confidence, effort: 'medium', cost_cents: null, time_to_value_days: 45,
        score: scoreOpportunity({ estImpactCents: estImpact, confidence, effort: 'medium', urgency: 0.3 }),
        source: 'rule', dedupe_key: `cat:${category}:growth`,
      });
      continue;
    }

    // Signal 3 — high realised value, steady volume (grow a proven category)
    if (avgRaisedRecent >= 25_000 && a.recentCount >= 3) {
      const estImpact = avgRaisedRecent * Math.ceil(a.recentCount * 0.2);
      drafts.push({
        title: `Grow the high-value ${category} category`,
        description: `${category} campaigns raise $${(avgRaisedRecent / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} on average — well above platform norm. A 20% volume lift is a strong donation-revenue play.`,
        rationale: `${a.recentCount} recent campaigns at a high average raise; incremental acquisition here converts efficiently to donation volume.`,
        evidence: { recentStarts: a.recentCount, avgRaisedCents: avgRaisedRecent, recentFundsCents: a.recentFunds },
        category, geography: null, audience: null, target_metric: 'donation_volume',
        est_impact_cents: estImpact || null, est_starts: Math.ceil(a.recentCount * 0.2) || null,
        confidence, effort: 'high', cost_cents: null, time_to_value_days: 60,
        score: scoreOpportunity({ estImpactCents: estImpact, confidence, effort: 'high', urgency: 0.2 }),
        source: 'rule', dedupe_key: `cat:${category}:highvalue`,
      });
    }
  }

  return drafts.sort((x, y) => y.score - x.score);
}
