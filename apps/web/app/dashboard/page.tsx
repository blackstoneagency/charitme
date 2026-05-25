import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { ProgressBar, Badge, Card, EmptyState } from '../../components/ui';
import { formatCents } from '../../lib/stripe';
import Link from 'next/link';
import ConnectButton from './ConnectButton';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

async function getMyCampaigns(userId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, goal_amount, raised_amount, backer_count, deadline, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

async function getRecentDonations(userId: string) {
  const { data } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, message, anonymous, created_at, campaigns!inner(title, slug, user_id), profiles:donor_id(full_name)')
    .eq('campaigns.user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

async function getProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('full_name, stripe_account_id, stripe_onboarded')
    .eq('id', userId)
    .single();
  return data;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [campaigns, donations, profile] = await Promise.all([
    getMyCampaigns(user.id),
    getRecentDonations(user.id),
    getProfile(user.id),
  ]);

  const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0);
  const totalDonors = campaigns.reduce((s, c) => s + (c.backer_count ?? 0), 0);

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px' }}>
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ color: 'var(--t3)', fontSize: '14px' }}>{user.email}</p>
        </div>
        <Link href="/create" style={{
          padding: '10px 22px',
          background: 'var(--green)',
          color: '#fff',
          borderRadius: 'var(--r)',
          fontWeight: 600,
          fontSize: '14px',
        }}>
          + New campaign
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {[
          { label: 'Total raised', value: formatCents(totalRaised) },
          { label: 'Total donors', value: totalDonors.toLocaleString() },
          { label: 'Active campaigns', value: campaigns.filter((c) => c.status === 'active').length.toString() },
        ].map((s) => (
          <Card key={s.label} style={{ padding: '20px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--t3)' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Stripe Connect */}
      <Card style={{ padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Payouts
            {profile?.stripe_onboarded
              ? <Badge color="green">Connected</Badge>
              : <Badge color="gray">Not set up</Badge>}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--t3)' }}>
            {profile?.stripe_onboarded
              ? 'Your Stripe account is connected. Donations will be paid out automatically.'
              : 'Connect Stripe to receive payouts from your campaigns.'}
          </p>
        </div>
        {!profile?.stripe_onboarded && (
          <ConnectButton userId={user.id} />
        )}
      </Card>

      {/* My campaigns */}
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>My campaigns</h2>
      {campaigns.length === 0 ? (
        <EmptyState
          icon="🌱"
          title="No campaigns yet"
          body="Start your first campaign and share it with your network."
          action={
            <Link href="/create" style={{ padding: '10px 22px', background: 'var(--green)', color: '#fff', borderRadius: 'var(--r)', fontWeight: 600, fontSize: '14px' }}>
              Create a campaign
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
          {campaigns.map((c) => {
            const days = c.deadline
              ? Math.max(0, Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86_400_000))
              : null;
            return (
              <Card key={c.id} style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Link href={`/campaigns/${c.slug}`} style={{ fontWeight: 700, fontSize: '15px', color: 'var(--t1)' }}>
                        {c.title}
                      </Link>
                      <Badge color={c.status === 'active' ? 'green' : 'gray'}>{c.status}</Badge>
                    </div>
                    <ProgressBar value={c.raised_amount ?? 0} max={c.goal_amount} />
                    <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '8px' }}>
                      {formatCents(c.raised_amount ?? 0)} raised of {formatCents(c.goal_amount)} goal
                      {days !== null && ` · ${days} days left`}
                      · {c.backer_count ?? 0} donors
                    </div>
                  </div>
                  <Link href={`/campaigns/${c.slug}`} style={{
                    padding: '7px 16px',
                    border: '1px solid var(--b1)',
                    borderRadius: 'var(--r)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--t2)',
                    flexShrink: 0,
                  }}>
                    View →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent donations */}
      {donations.length > 0 && (
        <>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Recent donations received</h2>
          <Card>
            {donations.map((d, i) => {
              const profile = d.profiles as { full_name?: string } | null;
              const campaign = d.campaigns as { title?: string; slug?: string } | null;
              return (
                <div key={d.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: i < donations.length - 1 ? '1px solid var(--b1)' : 'none',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      {d.anonymous ? 'Anonymous' : (profile?.full_name ?? 'Someone')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--t4)' }}>
                      to {campaign?.title ?? ''} · {new Date(d.created_at).toLocaleDateString()}
                    </div>
                    {d.message && <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '2px' }}>{d.message}</div>}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--green)' }}>
                    {formatCents(d.amount_cents)}
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
