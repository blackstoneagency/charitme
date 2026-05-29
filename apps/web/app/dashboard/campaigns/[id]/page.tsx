import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KindFundShell, TopBar, KFIcon } from '../../../../components/KindFundShellServer';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

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
};

type Donation = {
  id: string;
  amount_cents: number;
  anonymous: boolean;
  donor_id: string | null;
  donor_name: string;
  created_at: string;
  message: string | null;
};

type Update = {
  id: string;
  title: string | null;
  body: string;
  ai_generated: boolean;
  created_at: string;
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

function daysLeft(deadline: string | null): string {
  if (!deadline) return '—';
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

const AVATAR_COLORS = ['#6c35ff', '#19b86a', '#2f80ed', '#ec3fb4', '#f59e0b'];

function initials(name: string): string {
  return name.split(/\s+/).map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchCampaignDetail(campaignId: string, userId: string): Promise<{
  campaign: Campaign | null;
  donations: Donation[];
  updates: Update[];
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

    if (campErr || !campData) return { campaign: null, donations: [], updates: [], teamCount: 0 };

    const campaign = campData as Campaign;

    // Step 2: recent donations + updates + team count in parallel
    const [
      { data: donData },
      { data: updData },
      { count: teamCount },
    ] = await Promise.all([
      supabaseAdmin
        .from('donations')
        .select('id,amount_cents,anonymous,donor_id,created_at,message')
        .eq('campaign_id', campaignId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('campaign_updates')
        .select('id,title,body,ai_generated,created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId),
    ]);

    // Step 3: resolve donor names
    const rawDonations = (donData ?? []) as {
      id: string; amount_cents: number; anonymous: boolean;
      donor_id: string | null; created_at: string; message: string | null;
    }[];

    const donorIds = [...new Set(
      rawDonations.filter(d => d.donor_id && !d.anonymous).map(d => d.donor_id as string),
    )];

    const profileMap = new Map<string, string>();
    if (donorIds.length > 0) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('id,full_name')
        .in('id', donorIds);
      for (const p of (profileData ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) profileMap.set(p.id, p.full_name);
      }
    }

    const donations: Donation[] = rawDonations.map(d => ({
      ...d,
      donor_name: d.anonymous || !d.donor_id
        ? 'Anonymous'
        : (profileMap.get(d.donor_id) ?? 'Donor'),
    }));

    return {
      campaign,
      donations,
      updates: (updData ?? []) as Update[],
      teamCount: teamCount ?? 0,
    };
  } catch {
    return { campaign: null, donations: [], updates: [], teamCount: 0 };
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
  const { campaign, donations, updates, teamCount } = await fetchCampaignDetail(id, user.id);

  if (!campaign) notFound();

  const progress = campaign.goal_amount > 0
    ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100))
    : 0;

  const totalRaisedDisplay = fmtCents(campaign.raised_amount);
  const goalDisplay = fmtCents(campaign.goal_amount);
  const deadline = daysLeft(campaign.deadline);

  return (
    <KindFundShell active="My Campaigns">
      <TopBar
        title={campaign.title}
        subtitle={campaign.tagline ?? campaign.category ?? 'Campaign details'}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/dashboard/campaigns/${campaign.id}/edit`} className="kf-primary"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <KFIcon name="doc" /> Edit Campaign
            </Link>
            <a
              href={`/campaigns/${campaign.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="kf-outline"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <KFIcon name="send" /> View Public Page
            </a>
            <Link href="/dashboard/campaigns" className="kf-outline">
              ← Back
            </Link>
          </div>
        }
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
                  { label: 'Updates', value: String(updates.length) },
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

        {/* ── Two-col: Donations + Updates ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

          {/* Recent Donations */}
          <section className="kf-card" style={{ overflow: 'hidden' }}>
            <div className="kf-card-head">
              <h2>Recent Donations</h2>
              <Link href="/dashboard/donations" style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none' }}>
                View All →
              </Link>
            </div>
            {donations.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>
                <KFIcon name="gift" />
                <p style={{ marginTop: 10 }}>No donations yet.</p>
              </div>
            ) : (
              <div className="kf-rows">
                {donations.map((d, i) => (
                  <div key={d.id} className="kf-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials(d.donor_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13, display: 'block' }}>{d.donor_name}</strong>
                      {d.message && (
                        <p style={{ fontSize: 12, color: 'var(--t3)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          &ldquo;{d.message}&rdquo;
                        </p>
                      )}
                      <small style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDate(d.created_at)}</small>
                    </div>
                    <strong style={{ fontSize: 15, color: 'var(--green)', flexShrink: 0 }}>
                      {fmtCents(d.amount_cents)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {donations.length > 0 && (
              <div className="kf-table-footer" style={{ padding: '10px 20px', fontSize: 13, color: 'var(--t3)' }}>
                Showing {donations.length} most recent donations
              </div>
            )}
          </section>

          {/* Campaign Updates */}
          <section className="kf-card" style={{ overflow: 'hidden' }}>
            <div className="kf-card-head">
              <h2>Campaign Updates</h2>
              <Link href="/dashboard/updates/new" className="kf-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
                + Post Update
              </Link>
            </div>
            {updates.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>
                <KFIcon name="doc" />
                <p style={{ marginTop: 10 }}>No updates posted yet.</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Campaigns with updates raise 80% more.</p>
              </div>
            ) : (
              <div className="kf-rows">
                {updates.map((u) => (
                  <div key={u.id} className="kf-row" style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {u.title && (
                          <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>{u.title}</strong>
                        )}
                        <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                          {u.body}
                        </p>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <small style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDate(u.created_at)}</small>
                        {u.ai_generated && (
                          <span style={{ display: 'block', fontSize: 10, color: '#6c35ff', fontWeight: 700, marginTop: 2 }}>AI</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {updates.length > 0 && (
              <div className="kf-table-footer" style={{ padding: '10px 20px', fontSize: 13, color: 'var(--t3)' }}>
                Showing {updates.length} updates
              </div>
            )}
          </section>
        </div>

        {/* ── Description ── */}
        {campaign.description && (
          <section className="kf-card" style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Campaign Description</h2>
            <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {campaign.description.slice(0, 800)}{campaign.description.length > 800 ? '…' : ''}
            </p>
          </section>
        )}

        {/* ── Quick actions ── */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Campaign Tools</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { href: `/dashboard/campaigns/${campaign.id}/share`, icon: 'send', label: 'Share & AI Content', desc: 'UTM links + AI posts' },
              { href: `/dashboard/campaigns/${campaign.id}/thank-donors`, icon: 'chat', label: 'Thank Donors', desc: 'Email your supporters' },
              { href: `/dashboard/campaigns/${campaign.id}/ledger`, icon: 'doc', label: 'Fund Ledger', desc: 'Track how funds are used' },
              { href: `/dashboard/campaigns/${campaign.id}/edit`, icon: 'doc', label: 'Edit Campaign', desc: 'Update title, story, media' },
              { href: `/api/campaigns/${campaign.id}/qr-poster`, icon: 'send', label: 'Print QR Poster', desc: 'Download & print' },
              { href: `/dashboard/updates/new`, icon: 'doc', label: 'Post Update', desc: 'Keep donors informed' },
            ].map(action => (
              <Link key={action.href} href={action.href} target={action.href.startsWith('/api') ? '_blank' : undefined}
                style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px', border: '1px solid var(--b2)', borderRadius: 12, textDecoration: 'none', background: 'var(--s1)', transition: 'border-color .15s' }}>
                <KFIcon name={action.icon} />
                <strong style={{ fontSize: 13, color: 'var(--t1)', marginTop: 6 }}>{action.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>{action.desc}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </KindFundShell>
  );
}
