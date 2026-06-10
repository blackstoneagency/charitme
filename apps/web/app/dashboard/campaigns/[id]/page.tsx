import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharitMeShell, TopBar, KFIcon } from '../../../../components/CharitMeShellServer';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import CampaignControls from './_components/CampaignControls';
import SupportersPanel from './_components/SupportersPanel';

export const dynamic = 'force-dynamic';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

function daysLeft(deadline: string | null): string {
  if (!deadline) return 'â€”';
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Ended';
  return `${diff} day${diff !== 1 ? 's' : ''} left`;
}

function pillTone(status: string) {
  switch (status.toLowerCase()) {
    case 'active': return 'green';
    case 'paused': return 'orange';
    case 'completed': return 'violet';
    default: return 'red';
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Data fetch
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchCampaignDetail(campaignId: string, userId: string): Promise<{
  campaign: Campaign | null;
  updatesCount: number;
  teamCount: number;
}> {
  try {
    // Step 1: campaign (must be owned by user)
    const { data: campData, error: campErr } = await supabaseAdmin
      .from('campaigns')
      .select('id,title,slug,tagline,description,status,goal_amount,raised_amount,backer_count,cover_image_url,category,deadline,created_at,updated_at')
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Page
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { campaign, updatesCount, teamCount } = await fetchCampaignDetail(id, user.id);

  if (!campaign) notFound();

  const progress = campaign.goal_amount > 0
    ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100))
    : 0;

  const totalRaisedDisplay = fmtCents(campaign.raised_amount);
  const goalDisplay = fmtCents(campaign.goal_amount);
  const deadline = daysLeft(campaign.deadline);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title={campaign.title}
        subtitle={campaign.tagline ?? campaign.category ?? 'Campaign details'}
      />

      <div style={{ padding: '0 32px 40px', display: 'grid', gap: 24 }}>

        {/* â”€â”€ Status + Metrics strip â”€â”€ */}
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
                <span><strong style={{ color: 'var(--green)' }}>{totalRaisedDisplay}</strong> raised of {goalDisplay}</span>
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
            </div>
          </div>
        </div>

        {/* â”€â”€ Actions + Campaign Status â”€â”€ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href={`/dashboard/campaigns/${campaign.id}/edit`} className="kf-primary"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <KFIcon name="doc" /> Edit Campaign
            </Link>
            <Link href="/dashboard/campaigns" className="kf-outline"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
              â† Back
            </Link>
          </div>
          <CampaignControls campaignId={campaign.id} currentStatus={campaign.status} />
        </div>

        {/* â”€â”€ Campaign Tools â”€â”€ */}
        <section>
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Campaign Tools</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {[
              { href: `/dashboard/campaigns/${campaign.id}/supporters`, icon: 'users', label: 'My Supporters', desc: 'Donor CRM + re-engagement' },
              { href: `/dashboard/campaigns/${campaign.id}/share`, icon: 'send', label: 'Share & AI Content', desc: 'UTM links + AI posts' },
              { href: `/dashboard/campaigns/${campaign.id}/thank-donors`, icon: 'chat', label: 'Thank Donors', desc: 'Email your supporters' },
              { href: `/dashboard/campaigns/${campaign.id}/ledger`, icon: 'doc', label: 'Fund Ledger', desc: 'Track how funds are used' },
              { href: `/dashboard/campaigns/${campaign.id}/faqs`, icon: 'doc', label: 'Manage FAQs', desc: 'AI-generated Q&A' },
              { href: `/api/campaigns/${campaign.id}/qr-poster`, icon: 'send', label: 'Print QR Poster', desc: 'Download & print' },
              { href: `/dashboard/campaigns/${campaign.id}/updates`, icon: 'doc', label: 'Post Update', desc: 'Keep donors informed' },
              { href: `/dashboard/campaigns/${campaign.id}/analytics`, icon: 'chart', label: 'Analytics', desc: 'Trends & attribution' },
              { href: `/dashboard/campaigns/${campaign.id}/settings`, icon: 'settings', label: 'Settings', desc: 'Visibility & donations' },
            ].map(action => (
              <Link key={action.label} href={action.href} target={action.href.startsWith('/api') ? '_blank' : undefined}
                className="kf-card"
                style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 14px', textDecoration: 'none', transition: 'border-color .15s' }}>
                <KFIcon name={action.icon} />
                <strong style={{ fontSize: 13, color: 'var(--t1)', marginTop: 6 }}>{action.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>{action.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── My Supporters (replaces donations/updates) ── */}
        <SupportersPanel campaignId={campaign.id} showHeading />

      </div>
    </CharitMeShell>
  );
}
