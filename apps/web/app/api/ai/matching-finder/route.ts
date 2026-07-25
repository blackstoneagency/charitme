import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { attachCampaignCurrencies } from '../../../../lib/home-data';

export const dynamic = 'force-dynamic';

type DonationWithCategory = { campaign_id: string; campaigns: { category: string | null } | { category: string | null }[] | null };

type Candidate = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  trust_status: string | null;
  campaign_health_score: number | null;
  user_id: string;
};

type Recommendation = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string;
  coverImageUrl: string | null;
  goalAmount: number;
  raisedAmount: number;
  backerCount: number;
  percentFunded: number;
  trustStatus: string | null;
  healthScore: number;
  matchReason: string;
  currency?: string | null;
};

function categoryOf(row: DonationWithCategory): string | null {
  const c = row.campaigns;
  if (!c) return null;
  if (Array.isArray(c)) return c[0]?.category ?? null;
  return c.category ?? null;
}

function fallbackMessage(topCategories: string[], hasHistory: boolean): string {
  if (!hasHistory) {
    return "We don't have your giving history yet — here are some highly trusted, active campaigns to get started.";
  }
  if (topCategories.length === 0) {
    return 'Based on your giving history, here are some active campaigns you might want to support.';
  }
  if (topCategories.length === 1) {
    return `Because you've supported ${topCategories[0]} causes before, here are similar campaigns you might care about.`;
  }
  return `Because you've supported ${topCategories.slice(0, -1).join(', ')} and ${topCategories[topCategories.length - 1]} causes before, here are campaigns you might care about.`;
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`matching-finder:${user.id}`, 12, 60_000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { data: donationRows } = await supabaseAdmin
    .from('donations')
    .select('campaign_id, campaigns:campaign_id(category)')
    .eq('donor_id', user.id)
    .eq('status', 'completed')
    .limit(200);

  const donations = (donationRows ?? []) as unknown as DonationWithCategory[];
  const supportedCampaignIds = new Set(donations.map((d) => d.campaign_id));

  const categoryCounts = new Map<string, number>();
  for (const d of donations) {
    const category = categoryOf(d);
    if (!category) continue;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  const maxCount = Math.max(1, ...categoryCounts.values());

  const { data: candidateRows, error: candidatesError } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, category, cover_image_url, goal_amount, raised_amount, backer_count, trust_status, campaign_health_score, user_id')
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(150);

  if (candidatesError) return NextResponse.json({ error: candidatesError.message }, { status: 500 });

  const candidates = (candidateRows ?? []) as Candidate[];

  const scored = candidates
    .filter((c) => c.user_id !== user.id && !supportedCampaignIds.has(c.id))
    .map((c) => {
      const categoryAffinity = (categoryCounts.get(c.category) ?? 0) / maxCount;
      const healthScore = c.campaign_health_score ?? 0;
      const verifiedBoost = c.trust_status === 'Verified' ? 1 : 0;
      const score = categoryAffinity * 3 + (healthScore / 100) + verifiedBoost * 0.5;
      return { campaign: c, score, categoryAffinity };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const recommendationsBase: Recommendation[] = scored.map(({ campaign: c, categoryAffinity }) => {
    const matchReason = categoryAffinity > 0
      ? `Matches your interest in ${c.category} causes`
      : c.trust_status === 'Verified'
        ? 'Verified campaign with a strong CharitScore'
        : 'Active campaign trending on CharitMe';
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      tagline: c.tagline,
      category: c.category,
      coverImageUrl: c.cover_image_url,
      goalAmount: c.goal_amount,
      raisedAmount: c.raised_amount,
      backerCount: c.backer_count,
      percentFunded: c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0,
      trustStatus: c.trust_status,
      healthScore: c.campaign_health_score ?? 0,
      matchReason,
    };
  });

  const recommendations = await attachCampaignCurrencies(recommendationsBase);

  let message = fallbackMessage(topCategories, donations.length > 0);
  let model = 'fallback';

  if (openai && recommendations.length > 0) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Matching Finder AI. Write one short (1-2 sentence), warm message to a donor introducing a personalized list of recommended campaigns. Use only facts from the input — never invent campaign names or categories not provided. Return strict JSON: {"message": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              hasHistory: donations.length > 0,
              topCategories,
              recommendedTitles: recommendations.map((r) => r.title),
              recommendedCategories: recommendations.map((r) => r.category),
            }),
          },
        ],
      });
      const json = JSON.parse(response.output_text) as { message?: string };
      if (typeof json.message === 'string' && json.message.trim()) {
        message = json.message.trim();
        model = OPENAI_MODEL;
      }
    } catch {
      // keep fallback message
    }
  }

  await supabaseAdmin.from('ai_generations').insert({
    user_id: user.id,
    campaign_id: null,
    generation_type: 'matching_finder',
    prompt: { topCategories, hasHistory: donations.length > 0 },
    output: { recommendations: recommendations.map((r) => ({ id: r.id, title: r.title, category: r.category, matchReason: r.matchReason })), message },
    model,
  });

  return NextResponse.json({
    topCategories,
    recommendations,
    message,
    model,
  });
}
