import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';
import { calculateTrustScore, getTrustSignals, getTrustStatus, type CampaignTrustInput } from '../../../../lib/ai-platform';
import { buildCampaignTrustInput } from '../../../../lib/trust-signals';

export const dynamic = 'force-dynamic';

type Campaign = {
  id: string;
  title: string;
  user_id: string;
  beneficiary_profile_id: string | null;
  cover_image_url: string | null;
  tagline: string | null;
  description: string | null;
  deadline: string | null;
  raised_amount: number | null;
  goal_amount: number | null;
  backer_count: number | null;
  status: string;
  trust_status: string | null;
};

type Suggestion = {
  code: string;
  label: string;
  pointsGain: number;
  actionUrl: string | null;
  actionLabel: string | null;
};

function buildSuggestions(campaignId: string, input: CampaignTrustInput): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const editUrl = `/dashboard/campaigns/${campaignId}/edit`;

  if (!input.identity_verified) {
    suggestions.push({ code: 'identity_verified', label: 'Verify your identity', pointsGain: 12, actionUrl: '/dashboard/settings', actionLabel: 'Go to settings' });
  }
  if (input.admin_review_status !== 'approved') {
    suggestions.push({ code: 'admin_review_status', label: 'Get your campaign reviewed for a Verified badge', pointsGain: 10, actionUrl: '/contact', actionLabel: 'Request review' });
  }
  if (!input.beneficiary_verified) {
    suggestions.push({ code: 'beneficiary_verified', label: 'Verify the beneficiary receiving funds', pointsGain: 10, actionUrl: `/dashboard/campaigns/${campaignId}/payout-setup`, actionLabel: 'Payout setup' });
  }
  if (!input.stripe_onboarded) {
    suggestions.push({ code: 'stripe_onboarded', label: 'Connect Stripe to enable payouts', pointsGain: 10, actionUrl: `/dashboard/campaigns/${campaignId}/payout-setup`, actionLabel: 'Payout setup' });
  }
  if ((input.evidence_count ?? 0) === 0) {
    suggestions.push({ code: 'evidence_count', label: 'Add receipts, photos, or updates to your Transparency Ledger', pointsGain: 8, actionUrl: `/dashboard/campaigns/${campaignId}/ledger`, actionLabel: 'Open ledger' });
  }
  if ((input.description ?? '').length < 280) {
    suggestions.push({ code: 'description', label: 'Expand your story to at least 280 characters', pointsGain: 8, actionUrl: editUrl, actionLabel: 'Edit campaign' });
  }
  if (!input.cover_image_url) {
    suggestions.push({ code: 'cover_image_url', label: 'Add a cover photo', pointsGain: 6, actionUrl: editUrl, actionLabel: 'Edit campaign' });
  }
  if ((input.backer_count ?? 0) < 3) {
    suggestions.push({ code: 'backer_count', label: 'Get your first 3 donations to build social proof', pointsGain: 5, actionUrl: `/dashboard/campaigns/${campaignId}/share`, actionLabel: 'Share campaign' });
  }
  if ((input.tagline ?? '').length < 24) {
    suggestions.push({ code: 'tagline', label: 'Write a tagline of at least 24 characters', pointsGain: 4, actionUrl: editUrl, actionLabel: 'Edit campaign' });
  }
  if (!input.deadline) {
    suggestions.push({ code: 'deadline', label: 'Set a campaign deadline', pointsGain: 4, actionUrl: editUrl, actionLabel: 'Edit campaign' });
  }
  if (input.status !== 'active') {
    suggestions.push({ code: 'status', label: 'Publish your campaign as active', pointsGain: 4, actionUrl: `/dashboard/campaigns/${campaignId}/settings`, actionLabel: 'Settings' });
  }
  if ((input.risk_flag_count ?? 0) > 0) {
    const recoverable = Math.min(24, (input.risk_flag_count ?? 0) * 8);
    suggestions.push({
      code: 'risk_flags',
      label: `Resolve ${input.risk_flag_count} open risk flag${input.risk_flag_count === 1 ? '' : 's'} with our trust & safety team`,
      pointsGain: recoverable,
      actionUrl: '/contact',
      actionLabel: 'Contact support',
    });
  }

  return suggestions.sort((a, b) => b.pointsGain - a.pointsGain).slice(0, 5);
}

function fallbackMessage(opts: { title: string; score: number; status: string; topSuggestion: Suggestion | null }): string {
  const { title, score, status, topSuggestion } = opts;
  if (score >= 88) {
    return `"${title}" has a CharitScore of ${score} (${status}) — your trust signals are in great shape. Keep posting updates and ledger entries to maintain donor confidence.`;
  }
  if (!topSuggestion) {
    return `"${title}" has a CharitScore of ${score} (${status}). You're in good standing — keep your story and ledger up to date to maintain donor trust.`;
  }
  return `"${title}" has a CharitScore of ${score} (${status}). The fastest way to raise it: ${topSuggestion.label.toLowerCase()} for an estimated +${topSuggestion.pointsGain} points.`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

  if (!checkRateLimit(`trust-score:${user.id}`, 12, 60_000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id, beneficiary_profile_id, cover_image_url, tagline, description, deadline, raised_amount, goal_amount, backer_count, status, trust_status')
    .eq('id', campaignId)
    .maybeSingle<Campaign>();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const admin = await isAdmin(user.id, user.email);
  if (campaign.user_id !== user.id && !admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const trustInput = await buildCampaignTrustInput(campaign);
  const score = calculateTrustScore(trustInput);
  const status = getTrustStatus(score);
  const signals = getTrustSignals(trustInput);
  const suggestions = buildSuggestions(campaign.id, trustInput);

  let message = fallbackMessage({ title: campaign.title, score, status, topSuggestion: suggestions[0] ?? null });
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Trust Score Coach AI. Write one short (1-2 sentence), encouraging, specific message to a fundraiser explaining their CharitScore and the single most impactful action to raise it. Use only facts from the input — never invent numbers or signals not provided. Return strict JSON: {"message": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              score,
              status,
              suggestions: suggestions.map((s) => ({ label: s.label, pointsGain: s.pointsGain })),
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
    campaign_id: campaign.id,
    generation_type: 'trust_score',
    prompt: { campaignId, score, status },
    output: { score, status, signals, suggestions, message },
    model,
  });

  return NextResponse.json({
    score,
    status,
    signals,
    suggestions,
    message,
    model,
  });
}
