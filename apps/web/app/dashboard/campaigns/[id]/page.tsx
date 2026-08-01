import 'server-only';
import { notFound } from 'next/navigation';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import CampaignWorkspace from './_components/CampaignWorkspace';
import FeatureCampaignButton from './_components/FeatureCampaignButton';
import { resolveFeaturePriceCents } from '../../../../lib/featured';
import { campaignTimeLabel } from '../../../../lib/campaign-lifecycle';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Campaign = {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  description: string;
  status: string;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  cover_image_url: string | null;
  category: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  featured: boolean | null;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Countdown for the fundraiser's own campaign page.
 *
 * Takes `status` because this label renders directly beside the status pill —
 * reading the deadline alone is how a completed campaign showed "136 days left"
 * next to a pill saying otherwise. Shared with the public page via
 * lib/campaign-lifecycle so the fundraiser and their donors see the same thing.
 */
function daysLeft(deadline: string | null, status: string | null): string {
  return campaignTimeLabel({ status, deadline });
}

function pillTone(status: string) {
  switch (status.toLowerCase()) {
    case 'active': return 'green';
    case 'paused': return 'orange';
    case 'completed': return 'violet';
    default: return 'red';
  }
}

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchCampaignDetail(campaignId: string, userId: string): Promise<{
  campaign: Campaign | null;
  updatesCount: number;
  teamCount: number;
}> {
  try {
    // Step 1: campaign (must be owned by user)
    const { data: campData, error: campErr } = await supabaseAdmin
      .from('campaigns')
      .select('id,title,slug,tagline,description,status,goal_amount,raised_amount,backer_count,cover_image_url,category,deadline,created_at,updated_at,featured')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campErr || !campData) return { campaign: null, updatesCount: 0, teamCount: 0 };

    const campaign = campData as Campaign;

    // Step 2: updates + team counts in parallel
    const [
      { count: updatesCount },
      { count: teamCount },
    ] = await Promise.all([
      supabaseAdmin
        .from('campaign_updates')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId),
      supabaseAdmin
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId),
    ]);

    return {
      campaign,
      updatesCount: updatesCount ?? 0,
      teamCount: teamCount ?? 0,
    };
  } catch {
    return { campaign: null, updatesCount: 0, teamCount: 0 };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { campaign, updatesCount, teamCount } = await fetchCampaignDetail(id, user.id);

  if (!campaign) notFound();

  // Featured-campaign fee (admin-configurable in Super Admin → Settings → Payment).
  const { data: settingsRow } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();
  const paymentSettings =
    settingsRow?.config && typeof settingsRow.config === 'object' && !Array.isArray(settingsRow.config)
      ? (settingsRow.config as Record<string, unknown>).payment
      : undefined;
  const featurePriceLabel = fmtCents(resolveFeaturePriceCents(paymentSettings));

  const progress = campaign.goal_amount > 0
    ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100))
    : 0;

  const totalRaisedDisplay = fmtCents(campaign.raised_amount);
  const goalDisplay = fmtCents(campaign.goal_amount);
  const deadline = daysLeft(campaign.deadline, campaign.status);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title={campaign.title}
        subtitle={campaign.tagline ?? campaign.category ?? 'Campaign details'}
      />

      <div style={{ padding: '0 32px 40px', display: 'grid', gap: 24 }}>

        {/* ── Status + Metrics strip ── */}
        <div className="kf-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            {/* Cover image */}
            {campaign.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={campaign.cover_image_url}
                alt={campaign.title}
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: 12, background: 'linear-gradient(135deg,#ede9fe,#6c35ff)', flexShrink: 0 }} />
            )}

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span className={`kf-pill ${pillTone(campaign.status)}`}>
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
                {campaign.category && (
                  <span style={{ fontSize: 12, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 8px', borderRadius: 6 }}>
                    {campaign.category}
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 'auto' }}>
                  Created {fmtDate(campaign.created_at)}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--t2)', marginBottom: 6 }}>
                <span><strong style={{ color: 'var(--green-text)' }}>{totalRaisedDisplay}</strong> raised of {goalDisplay}</span>
                <span><strong>{progress}%</strong> funded</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--b1)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--green)', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>

              {/* Stat row */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                  { label: 'Backers', value: campaign.backer_count.toLocaleString() },
                  { label: 'Deadline', value: deadline },
                  { label: 'Team Members', value: String(teamCount) },
                  { label: 'Updates', value: String(updatesCount) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <strong style={{ fontSize: 18, fontWeight: 700, display: 'block', lineHeight: 1 }}>{value}</strong>
                    <small style={{ fontSize: 12, color: 'var(--t3)' }}>{label}</small>
                  </div>
                ))}
              </div>

              {/* Featured-campaign placement */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <FeatureCampaignButton
                  campaignId={campaign.id}
                  featured={campaign.featured === true}
                  priceLabel={featurePriceLabel}
                />
                {!campaign.featured && (
                  <span style={{ fontSize: 12.5, color: 'var(--t3)', maxWidth: 340 }}>
                    Featured campaigns rotate through the homepage spotlight for extra visibility.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Workspace: actions, status, tools + active tool content ── */}
        <CampaignWorkspace campaignId={campaign.id} currentStatus={campaign.status} />

      </div>
    </CharitMeShell>
  );
}
