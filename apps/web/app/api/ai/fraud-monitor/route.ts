import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';
import {
  detectRiskFlags,
  detectVelocityAnomaly,
  detectRefundAnomaly,
  detectDuplicateContent,
  type RiskFlag,
} from '../../../../lib/risk';

export const dynamic = 'force-dynamic';

type Campaign = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  beneficiary_name: string | null;
  cover_image_url: string | null;
  raised_amount: number;
  status: string;
  created_at: string;
};

type Donation = { campaign_id: string; amount_cents: number; status: string; created_at: string };
type Payout = { campaign_id: string; amount_cents: number };
type ExistingFlag = { campaign_id: string; flag_type: string };

type FlaggedCampaign = {
  campaignId: string;
  campaignTitle: string;
  flags: { code: string; label: string; severity: string }[];
};

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function fallbackSummary(scanned: number, newFlagsCount: number, flaggedCampaigns: FlaggedCampaign[]): string {
  if (scanned === 0) return 'No active campaigns to scan.';
  if (newFlagsCount === 0) {
    return `Scanned ${scanned} active campaign${scanned === 1 ? '' : 's'} — no new risk signals detected.`;
  }
  const names = flaggedCampaigns.slice(0, 3).map((f) => f.campaignTitle).join(', ');
  return `Scanned ${scanned} active campaign${scanned === 1 ? '' : 's'} and flagged ${newFlagsCount} new risk signal${newFlagsCount === 1 ? '' : 's'} across ${flaggedCampaigns.length} campaign${flaggedCampaigns.length === 1 ? '' : 's'}, including ${names}. Review the Trust & Safety queue for details.`;
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await isAdmin(user.id, user.email);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!checkRateLimit(`fraud-monitor:${user.id}`, 5, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { data: campaignsData, error: campaignsError } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, title, description, beneficiary_name, cover_image_url, raised_amount, status, created_at')
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(150);

  if (campaignsError) return NextResponse.json({ error: campaignsError.message }, { status: 500 });

  const campaigns = (campaignsData ?? []) as Campaign[];

  if (campaigns.length === 0) {
    const message = fallbackSummary(0, 0, []);
    await supabaseAdmin.from('ai_generations').insert({
      user_id: user.id,
      campaign_id: null,
      generation_type: 'fraud_monitor',
      prompt: { scanned: 0 },
      output: { scanned: 0, newFlagsCount: 0, flaggedCampaigns: [] },
      model: 'fallback',
    });
    return NextResponse.json({ scanned: 0, newFlagsCount: 0, flaggedCampaigns: [], message, model: 'fallback' });
  }

  const campaignIds = campaigns.map((c) => c.id);
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  const [donationsResult, flagsResult, payoutsResult] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('campaign_id, amount_cents, status, created_at')
      .in('campaign_id', campaignIds)
      .gte('created_at', since90)
      .limit(5000),
    supabaseAdmin
      .from('risk_flags')
      .select('campaign_id, flag_type')
      .in('campaign_id', campaignIds)
      .eq('resolved', false),
    supabaseAdmin
      .from('payouts')
      .select('campaign_id, amount_cents')
      .in('campaign_id', campaignIds)
      .in('status', ['requested', 'approved']),
  ]);

  const donations = (donationsResult.data ?? []) as Donation[];
  const existingFlags = (flagsResult.data ?? []) as ExistingFlag[];
  const pendingPayouts = (payoutsResult.data ?? []) as Payout[];

  const existingFlagSet = new Set(existingFlags.map((f) => `${f.campaign_id}:${f.flag_type}`));

  const userCampaignCounts = new Map<string, number>();
  for (const c of campaigns) {
    if (new Date(c.created_at).getTime() >= since24h) {
      userCampaignCounts.set(c.user_id, (userCampaignCounts.get(c.user_id) ?? 0) + 1);
    }
  }

  const donationStats = new Map<string, { total: number; refunded: number; last24h: number }>();
  for (const d of donations) {
    const s = donationStats.get(d.campaign_id) ?? { total: 0, refunded: 0, last24h: 0 };
    s.total += 1;
    if (d.status === 'refunded') s.refunded += 1;
    if (new Date(d.created_at).getTime() >= since24h) s.last24h += 1;
    donationStats.set(d.campaign_id, s);
  }

  const payoutTotals = new Map<string, number>();
  for (const p of pendingPayouts) {
    payoutTotals.set(p.campaign_id, (payoutTotals.get(p.campaign_id) ?? 0) + (p.amount_cents ?? 0));
  }

  const descriptionGroups = new Map<string, Set<string>>();
  const beneficiaryGroups = new Map<string, Set<string>>();
  const coverImageGroups = new Map<string, Set<string>>();

  for (const c of campaigns) {
    const desc = normalize(c.description);
    if (desc && desc.length > 40) {
      const set = descriptionGroups.get(desc) ?? new Set<string>();
      set.add(c.user_id);
      descriptionGroups.set(desc, set);
    }
    const ben = normalize(c.beneficiary_name);
    if (ben) {
      const set = beneficiaryGroups.get(ben) ?? new Set<string>();
      set.add(c.user_id);
      beneficiaryGroups.set(ben, set);
    }
    const img = normalize(c.cover_image_url);
    if (img) {
      const set = coverImageGroups.get(img) ?? new Set<string>();
      set.add(c.user_id);
      coverImageGroups.set(img, set);
    }
  }

  const detectedAt = new Date().toISOString();
  const newFlagRows: {
    campaign_id: string;
    user_id: string;
    code: string;
    flag_type: string;
    label: string;
    severity: string;
    description: string;
    status: string;
    resolved: boolean;
    metadata: Record<string, unknown>;
  }[] = [];
  const flaggedCampaigns: FlaggedCampaign[] = [];

  for (const c of campaigns) {
    const flags: RiskFlag[] = [];
    const stats = donationStats.get(c.id) ?? { total: 0, refunded: 0, last24h: 0 };
    const avgDailyDonations = Math.max(0, stats.total - stats.last24h) / 89;
    const payoutCents = payoutTotals.get(c.id) ?? 0;

    flags.push(
      ...detectRiskFlags({
        story: c.description ?? '',
        campaignCountLastDay: userCampaignCounts.get(c.user_id) ?? 0,
        payoutCents,
        raisedCents: c.raised_amount,
      })
    );

    const velocity = detectVelocityAnomaly({ donationsLast24h: stats.last24h, avgDailyDonations });
    if (velocity) flags.push(velocity);

    const refund = detectRefundAnomaly({ totalDonations: stats.total, refundedDonations: stats.refunded });
    if (refund) flags.push(refund);

    const desc = normalize(c.description);
    if (desc && desc.length > 40) {
      const others = [...(descriptionGroups.get(desc) ?? new Set<string>())].filter((u) => u !== c.user_id).length;
      const dup = detectDuplicateContent('duplicate_story', others);
      if (dup) flags.push(dup);
    }

    const ben = normalize(c.beneficiary_name);
    if (ben) {
      const others = [...(beneficiaryGroups.get(ben) ?? new Set<string>())].filter((u) => u !== c.user_id).length;
      const dup = detectDuplicateContent('duplicate_beneficiary', others);
      if (dup) flags.push(dup);
    }

    const img = normalize(c.cover_image_url);
    if (img) {
      const others = [...(coverImageGroups.get(img) ?? new Set<string>())].filter((u) => u !== c.user_id).length;
      const dup = detectDuplicateContent('media_reuse', others);
      if (dup) flags.push(dup);
    }

    const newFlagsForCampaign: RiskFlag[] = [];
    for (const flag of flags) {
      const key = `${c.id}:${flag.code}`;
      if (existingFlagSet.has(key)) continue;
      existingFlagSet.add(key);
      newFlagsForCampaign.push(flag);
      newFlagRows.push({
        campaign_id: c.id,
        user_id: c.user_id,
        code: flag.code,
        flag_type: flag.code,
        label: flag.label,
        severity: flag.severity,
        description: flag.label,
        status: 'open',
        resolved: false,
        metadata: { source: 'ai_fraud_monitor', detectedAt },
      });
    }

    if (newFlagsForCampaign.length > 0) {
      flaggedCampaigns.push({
        campaignId: c.id,
        campaignTitle: c.title,
        flags: newFlagsForCampaign.map((f) => ({ code: f.code, label: f.label, severity: f.severity })),
      });
    }
  }

  if (newFlagRows.length > 0) {
    await supabaseAdmin.from('risk_flags').insert(newFlagRows);
  }

  let message = fallbackSummary(campaigns.length, newFlagRows.length, flaggedCampaigns);
  let model = 'fallback';

  if (openai && newFlagRows.length > 0) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Fraud & Misuse Monitor AI. Summarize the results of an automated fraud scan in one short (2-3 sentence), neutral, factual paragraph for an admin audience. Use only facts from the input — never invent campaign names, counts, or accusations beyond what is provided. Return strict JSON: {"message": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              scanned: campaigns.length,
              newFlagsCount: newFlagRows.length,
              flaggedCampaigns: flaggedCampaigns.map((f) => ({
                title: f.campaignTitle,
                flags: f.flags.map((fl) => fl.label),
              })),
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
    generation_type: 'fraud_monitor',
    prompt: { scanned: campaigns.length },
    output: { scanned: campaigns.length, newFlagsCount: newFlagRows.length, flaggedCampaigns },
    model,
  });

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'fraud_monitor.scan',
    target_type: 'system',
    target_id: 'fraud_monitor',
    metadata: {
      scanned: campaigns.length,
      newFlagsCount: newFlagRows.length,
      flaggedCampaignIds: flaggedCampaigns.map((f) => f.campaignId),
    },
  });

  return NextResponse.json({
    scanned: campaigns.length,
    newFlagsCount: newFlagRows.length,
    flaggedCampaigns,
    message,
    model,
  });
}
