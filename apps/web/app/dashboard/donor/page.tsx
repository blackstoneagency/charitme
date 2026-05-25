import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatCents } from '../../../lib/stripe';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Donation History' };
export const dynamic = 'force-dynamic';

type DonationRow = {
  id: string;
  amount_cents: number;
  message: string | null;
  anonymous: boolean;
  created_at: string;
  status: string;
  campaigns: { title: string; slug: string } | null;
};

async function getDonations(userId: string): Promise<DonationRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from('donations')
      .select('id, amount_cents, message, anonymous, created_at, status, campaigns!inner(title, slug)')
      .eq('donor_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as unknown as DonationRow[];
  } catch {
    return [];
  }
}

async function getDonorProfile(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    return data;
  } catch {
    return null;
  }
}

export default async function DonorDashboardPage() {
  const user = await requireUser();
  const [donations, profile] = await Promise.all([
    getDonations(user.id),
    getDonorProfile(user.id),
  ]);

  const completedDonations = donations.filter((d) => d.status === 'completed');
  const pendingDonations = donations.filter((d) => d.status !== 'completed');
  const totalDonated = completedDonations.reduce((s, d) => s + (d.amount_cents ?? 0), 0);
  const uniqueCampaigns = new Set(completedDonations.map((d) => d.campaigns?.slug)).size;

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px' }}>
            Donation history{profile?.full_name ? ` — ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ color: 'var(--t3)', fontSize: '14px' }}>{user.email}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/campaigns" style={{
            padding: '10px 22px',
            background: 'var(--green)',
            color: '#fff',
            borderRadius: 'var(--r)',
            fontWeight: 600,
            fontSize: '14px',
          }}>
            Find campaigns
          </Link>
          <Link href="/dashboard" style={{
            padding: '10px 22px',
            border: '1px solid var(--b1)',
            borderRadius: 'var(--r)',
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--t2)',
          }}>
            Fundraiser dashboard
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {[
          { label: 'Total donated', value: formatCents(totalDonated) },
          { label: 'Total donations', value: completedDonations.length.toLocaleString() },
          { label: 'Campaigns supported', value: uniqueCampaigns.toLocaleString() },
          {
            label: 'Avg donation',
            value: completedDonations.length > 0
              ? formatCents(Math.round(totalDonated / completedDonations.length))
              : '$0',
          },
        ].map((s) => (
          <div key={s.label} style={{ border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '20px', background: '#fff' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--t3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completed donations */}
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Donation history</h2>

      {completedDonations.length === 0 ? (
        <div style={{
          border: '1px solid var(--b1)',
          borderRadius: 'var(--rl)',
          padding: '60px 20px',
          textAlign: 'center',
          background: '#fff',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>❤️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No donations yet</div>
          <p style={{ color: 'var(--t3)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
            Browse campaigns and make your first donation. Your full history appears here.
          </p>
          <Link href="/campaigns" style={{
            padding: '10px 24px',
            background: 'var(--green)',
            color: '#fff',
            borderRadius: 'var(--r)',
            fontWeight: 600,
            fontSize: '14px',
          }}>
            Browse campaigns
          </Link>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--b1)', borderRadius: 'var(--rl)', overflow: 'hidden', background: '#fff' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 110px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--b1)',
            background: 'var(--s1)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--t3)',
            gap: '8px',
          }}>
            <span>Campaign</span>
            <span>Date</span>
            <span>Amount</span>
          </div>
          {completedDonations.map((donation, i) => {
            const campaign = donation.campaigns;
            return (
              <div key={donation.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 110px',
                padding: '14px 20px',
                borderBottom: i < completedDonations.length - 1 ? '1px solid var(--b1)' : 'none',
                alignItems: 'start',
                gap: '8px',
              }}>
                <div>
                  {campaign ? (
                    <Link href={`/campaigns/${campaign.slug}`} style={{ fontWeight: 600, fontSize: '14px', color: 'var(--t1)' }}>
                      {campaign.title}
                    </Link>
                  ) : (
                    <span style={{ fontSize: '14px', color: 'var(--t3)' }}>Campaign removed</span>
                  )}
                  {donation.message && (
                    <div style={{ fontSize: '12px', color: 'var(--t4)', marginTop: '2px', fontStyle: 'italic' }}>
                      &ldquo;{donation.message}&rdquo;
                    </div>
                  )}
                  {donation.anonymous && (
                    <div style={{ fontSize: '11px', color: 'var(--t4)', marginTop: '2px' }}>
                      Given anonymously
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--t3)', paddingTop: '2px' }}>
                  {new Date(donation.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--green)', paddingTop: '2px' }}>
                  {formatCents(donation.amount_cents)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completedDonations.length > 0 && (
        <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--t4)' }}>
          Payment receipts are automatically emailed by Stripe after each donation.{' '}
          <Link href="/contact" style={{ color: 'var(--green)', fontWeight: 600 }}>Contact support</Link>{' '}
          if you need a receipt re-sent.
        </p>
      )}

      {/* Pending donations */}
      {pendingDonations.length > 0 && (
        <>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '40px', marginBottom: '16px' }}>Pending</h2>
          <div style={{ border: '1px solid var(--b1)', borderRadius: 'var(--rl)', overflow: 'hidden', background: '#fff' }}>
            {pendingDonations.map((donation, i) => {
              const campaign = donation.campaigns;
              return (
                <div key={donation.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: i < pendingDonations.length - 1 ? '1px solid var(--b1)' : 'none',
                  gap: '8px',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--t1)' }}>
                      {campaign?.title ?? 'Unknown campaign'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--t4)' }}>
                      {new Date(donation.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700 }}>{formatCents(donation.amount_cents)}</span>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#fef9c3',
                      color: '#854d0e',
                    }}>
                      {donation.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
