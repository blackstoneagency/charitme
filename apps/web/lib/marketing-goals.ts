import 'server-only';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { supabaseAdmin } from './supabase';

// ── Metric catalogue ────────────────────────────────────────────────────────
// Each metric declares its unit and whether the Marketing OS can currently
// measure it against LIVE CharitMe data. Metrics without a live measurement are
// stored and shown honestly as "measurement pending" — never faked.
export const GOAL_METRICS = {
  fundraiser_starts:      { label: 'New fundraiser starts',      unit: 'count',   live: true },
  donation_volume:        { label: 'Donation volume',           unit: 'cents',   live: true },
  recurring_donors:       { label: 'Recurring donors',          unit: 'count',   live: false },
  donation_conversion:    { label: 'Donation conversion rate',  unit: 'percent', live: false },
  verified_charities:     { label: 'Verified charity signups',  unit: 'count',   live: false },
  donor_acquisition_cost: { label: 'Donor acquisition cost',    unit: 'cents',   live: false },
  organizer_retention:    { label: 'Organizer retention',       unit: 'percent', live: false },
  aeo_visibility:         { label: 'AI / AEO visibility',       unit: 'percent', live: false },
  organic_traffic:        { label: 'Organic traffic',           unit: 'count',   live: false },
  custom:                 { label: 'Custom metric',             unit: 'count',   live: false },
} as const;

export type GoalMetric = keyof typeof GOAL_METRICS;
export type GoalUnit = 'count' | 'cents' | 'percent' | 'ratio';
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type GoalStatus = 'draft' | 'active' | 'paused' | 'achieved' | 'missed' | 'archived';

export interface MarketingGoal {
  id: string;
  title: string;
  description: string | null;
  objective: string | null;
  natural_language_input: string | null;
  target_metric: GoalMetric;
  baseline_value: number | null;
  target_value: number | null;
  unit: GoalUnit;
  deadline: string | null;
  priority: GoalPriority;
  geography: string | null;
  audience: string | null;
  category: string | null;
  budget_cents: number | null;
  channels: string[];
  autonomy_level: number;
  constraints: Record<string, unknown>;
  status: GoalStatus;
  confidence: number | null;
  forecast_value: number | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  metric: GoalMetric;
  measurable: boolean;          // false → "measurement pending", surfaced honestly in the UI
  current: number | null;       // live measured value since the goal was created
  target: number | null;
  baseline: number | null;
  gained: number | null;        // current − baseline (progress attributable since goal set)
  percent: number | null;       // 0..100 toward target, null when not computable
  note: string;
}

// Derived, not hand-listed — a duplicate of this list in campaign-followups.ts
// had silently drifted to 11 of the 18 categories.
const CATEGORIES = new Set<string>(CAMPAIGN_CATEGORIES);

// ── Deterministic natural-language → structured draft ────────────────────────
// Turns "Grow verified education fundraisers in New Jersey by 15% before Dec 1"
// into a structured goal draft the leader can review and edit. Deterministic and
// dependency-free so it works with zero external AI configured; an optional AI
// refinement can be layered on later without changing this contract.
export interface GoalDraft {
  title: string;
  objective: string;
  target_metric: GoalMetric;
  unit: GoalUnit;
  target_value: number | null;
  deadline: string | null;
  priority: GoalPriority;
  geography: string | null;
  category: string | null;
  audience: string | null;
  channels: string[];
  natural_language_input: string;
}

export function draftGoalFromText(raw: string): GoalDraft {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // metric
  let metric: GoalMetric = 'custom';
  if (/\brecurring|monthly (donor|giv)/.test(lower)) metric = 'recurring_donors';
  else if (/\bconversion|convert\b/.test(lower)) metric = 'donation_conversion';
  else if (/\bverif(y|ied)|charity signup|nonprofit signup/.test(lower)) metric = 'verified_charities';
  else if (/\bacquisition cost|cac\b|cost per/.test(lower)) metric = 'donor_acquisition_cost';
  else if (/\bretention|retain\b/.test(lower)) metric = 'organizer_retention';
  else if (/\bai overview|chatgpt|gemini|perplexity|aeo\b|ai (search|visibility|discovery)/.test(lower)) metric = 'aeo_visibility';
  else if (/\borganic|seo\b|search traffic|visibility in .*search/.test(lower)) metric = 'organic_traffic';
  else if (/\bdonation (volume|amount|revenue)|raise (more|\$)|amount raised/.test(lower)) metric = 'donation_volume';
  else if (/\bfundraiser|campaign start|new campaign|organizer|start.*fundraiser/.test(lower)) metric = 'fundraiser_starts';

  const unit = GOAL_METRICS[metric].unit as GoalUnit;

  // target value — "by 15%", "$50,000", "500 more"
  let target: number | null = null;
  const pct = lower.match(/(\d+(?:\.\d+)?)\s*%/);
  const dollars = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  const plain = lower.match(/\b([\d,]{2,})\b/);
  if (unit === 'percent' && pct) target = Number(pct[1]);
  else if (unit === 'cents' && dollars) target = Math.round(Number(dollars[1].replace(/,/g, '')) * 100);
  else if (pct) target = Number(pct[1]);
  else if (dollars) target = Math.round(Number(dollars[1].replace(/,/g, '')) * 100);
  else if (plain) target = Number(plain[1].replace(/,/g, ''));

  // deadline — "before Dec 1", "by year-end", "in 30 days"
  let deadline: string | null = null;
  const days = lower.match(/in\s+(\d+)\s+days?/);
  if (days) {
    deadline = new Date(Date.now() + Number(days[1]) * 86_400_000).toISOString().slice(0, 10);
  } else if (/year[-\s]?end|giving tuesday|december|dec\b/.test(lower)) {
    const y = new Date().getFullYear();
    deadline = `${y}-12-31`;
  }

  // priority
  let priority: GoalPriority = 'medium';
  if (/\bcritical|urgent|asap|immediately\b/.test(lower)) priority = 'critical';
  else if (/\bhigh priority|important|key\b/.test(lower)) priority = 'high';

  // geography — "in New Jersey", "in the Northeast"
  let geography: string | null = null;
  const geo = text.match(/\bin\s+(?:the\s+)?([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/);
  if (geo && !CATEGORIES.has(geo[1])) geography = geo[1];

  // category
  let category: string | null = null;
  for (const c of CATEGORIES) {
    if (lower.includes(c.toLowerCase())) { category = c; break; }
  }
  if (!category && /\bschool|student|classroom|education\b/.test(lower)) category = 'Education';
  if (!category && /\banimal|rescue|pet|shelter\b/.test(lower)) category = 'Animal';

  // audience
  let audience: string | null = null;
  if (/\bparent|alumni\b/.test(lower)) audience = 'Parents & alumni';
  else if (/\bcorporate|company|employer\b/.test(lower)) audience = 'Corporate giving teams';
  else if (/\brecurring|monthly\b/.test(lower)) audience = 'Recurring donors';

  // channels
  const channels: string[] = [];
  if (/\bemail\b/.test(lower)) channels.push('email');
  if (/\bsocial|instagram|facebook|tiktok\b/.test(lower)) channels.push('social');
  if (/\bseo|search|organic\b/.test(lower)) channels.push('seo');
  if (/\bpaid|ads?\b/.test(lower)) channels.push('paid');

  const title = text.length > 90 ? `${text.slice(0, 87)}…` : text;

  return {
    title,
    objective: text,
    target_metric: metric,
    unit,
    target_value: target,
    deadline,
    priority,
    geography,
    category,
    audience,
    channels,
    natural_language_input: text,
  };
}

// ── Live progress measurement ────────────────────────────────────────────────
// Measures a goal against real tables. Only metrics flagged `live` are computed;
// everything else returns measurable:false so the UI can say so plainly.
export async function measureGoalProgress(goal: MarketingGoal): Promise<GoalProgress> {
  const meta = GOAL_METRICS[goal.target_metric];
  const base: GoalProgress = {
    metric: goal.target_metric,
    measurable: false,
    current: null,
    target: goal.target_value,
    baseline: goal.baseline_value,
    gained: null,
    percent: null,
    note: 'Measurement for this metric is not yet wired to a live data source.',
  };
  if (!meta.live) return base;

  try {
    if (goal.target_metric === 'fundraiser_starts') {
      let q = supabaseAdmin
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', goal.created_at)
        .neq('status', 'draft');
      if (goal.category && CATEGORIES.has(goal.category)) q = q.eq('category', goal.category);
      const { count } = await q;
      return finalize(base, goal, count ?? 0, 'Live count of published campaigns created since this goal was set.');
    }

    if (goal.target_metric === 'donation_volume') {
      const { data } = await supabaseAdmin
        .from('donations')
        .select('amount_cents')
        .eq('status', 'completed')
        .gte('created_at', goal.created_at)
        .limit(50_000);
      const sum = (data ?? []).reduce((t, d) => t + (d.amount_cents ?? 0), 0);
      return finalize(base, goal, sum, 'Live sum of completed donation amounts since this goal was set.');
    }
  } catch {
    return { ...base, note: 'Live measurement is temporarily unavailable.' };
  }
  return base;
}

function finalize(base: GoalProgress, goal: MarketingGoal, current: number, note: string): GoalProgress {
  const baseline = goal.baseline_value ?? 0;
  const gained = current - baseline;
  let percent: number | null = null;
  if (goal.target_value != null && goal.target_value > baseline) {
    percent = Math.max(0, Math.min(100, (gained / (goal.target_value - baseline)) * 100));
  }
  return { ...base, measurable: true, current, gained, percent, note };
}
