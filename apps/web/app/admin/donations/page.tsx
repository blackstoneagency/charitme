import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import DonationsClient, {
  type DonationRecord,
  type WeekPoint,
  type CampaignVolume,
  type TopDonor,
} from './_components/DonationsClient';

export const dynamic = 'force-dynamic';

function fmtWeek(iso: string): string {
  return iso.slice(0, 10);
}

export default async function AdminDonationsPage() {
  await requireAdmin();

  // ── Parallel fetches ────────────────────────────────────────────────
  const [
    { data: donations, count: totalDonationCount },
    { data: allCompleted },
    { count: completedCount },
    { count: pendingCount },
    { count: refundedCount },
    { count: failedCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('id,campaign_id,donor_id,amount_cents,status,anonymous,message,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('donations')
      .select('amount_cents,donor_id')
      .eq('status', 'completed'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'refunded'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  type RawDonation = {
    id: string;
    campaign_id: string;
    donor_id: string | null;
    amount_cents: number;
    status: string;
    anonymous: boolean;
    message: string | null;
    created_at: string;
  };

  const donationList = (donations ?? []) as RawDonation[];
  const completedList = (allCompleted ?? []) as { amount_cents: number; donor_id: string | null }[];

  const totalCents = completedList.reduce((s, d) => s + (d.amount_cents ?? 0), 0);
  const donorIds = new Set(completedList.map(d => d.donor_id).filter(Boolean));
  const donorCount = donorIds.size;
  const avgCents = (completedCount ?? 0) > 0 ? Math.round(totalCents / (completedCount ?? 1)) : 0;

  // ── Resolve campaign titles ─────────────────────────────────────────
  const campaignIds = [...new Set(donationList.map(d => d.campaign_id))];
  const campaignMap = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns').select('id,title').in('id', campaignIds);
    for (const c of (campaigns ?? []) as { id: string; title: string }[]) {
      campaignMap.set(c.id, c.title);
    }
  }

  // ── Resolve donor profiles ──────────────────────────────────────────
  const allDonorIds = [...new Set(donationList.map(d => d.donor_id).filter(Boolean))] as string[];
  const profileMap = new Map<string, { name: string; email: string }>();
  if (allDonorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('id,full_name').in('id', allDonorIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      profileMap.set(p.id, { name: p.full_name ?? 'Unknown Donor', email: '' });
    }
    // Get emails via auth admin (limit to avoid over-fetching)
    try {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      for (const u of authUsers?.users ?? []) {
        const existing = profileMap.get(u.id);
        if (existing) profileMap.set(u.id, { ...existing, email: u.email ?? '' });
      }
    } catch {
      // ignore auth fetch errors
    }
  }

  // ── Weekly trend (last 8 weeks) ──────────────────────────────────────
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const { data: trendData } = await supabaseAdmin
    .from('donations')
    .select('amount_cents,created_at,status')
    .gte('created_at', eightWeeksAgo.toISOString())
    .order('created_at', { ascending: true });

  const weekMap = new Map<string, { total_cents: number; count: number }>();
  for (const d of (trendData ?? []) as { amount_cents: number; created_at: string; status: string }[]) {
    const date = new Date(d.created_at);
    // Get the Monday of this week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const key = monday.toISOString().slice(0, 10);
    const existing = weekMap.get(key) ?? { total_cents: 0, count: 0 };
    weekMap.set(key, { total_cents: existing.total_cents + (d.amount_cents ?? 0), count: existing.count + 1 });
  }
  const weeklyTrend: WeekPoint[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, v]) => ({ week: fmtWeek(week), ...v }));

  // ── Campaign volumes ────────────────────────────────────────────────
  const campaignVolumeMap = new Map<string, number>();
  for (const d of donationList) {
    campaignVolumeMap.set(d.campaign_id, (campaignVolumeMap.get(d.campaign_id) ?? 0) + d.amount_cents);
  }
  const campaignVolumes: CampaignVolume[] = [...campaignVolumeMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([campaign_id, total_cents]) => ({
      campaign_id,
      campaign_title: campaignMap.get(campaign_id) ?? 'Unknown Campaign',
      total_cents,
    }));

  // ── Top donors ──────────────────────────────────────────────────────
  const donorVolumeMap = new Map<string, { total_cents: number; count: number }>();
  for (const d of donationList) {
    if (d.donor_id && !d.anonymous) {
      const existing = donorVolumeMap.get(d.donor_id) ?? { total_cents: 0, count: 0 };
      donorVolumeMap.set(d.donor_id, { total_cents: existing.total_cents + d.amount_cents, count: existing.count + 1 });
    }
  }
  const topDonors: TopDonor[] = [...donorVolumeMap.entries()]
    .sort(([, a], [, b]) => b.total_cents - a.total_cents)
    .slice(0, 10)
    .map(([donor_id, v]) => ({
      donor_id,
      donor_name: profileMap.get(donor_id)?.name ?? 'Unknown Donor',
      total_cents: v.total_cents,
      donation_count: v.count,
    }));

  // ── Build donation records ───────────────────────────────────────────
  const records: DonationRecord[] = donationList.map(d => ({
    id: d.id,
    donor_name: d.anonymous || !d.donor_id ? 'Anonymous' : (profileMap.get(d.donor_id)?.name ?? 'Unknown Donor'),
    donor_email: d.anonymous || !d.donor_id ? '' : (profileMap.get(d.donor_id)?.email ?? ''),
    campaign_title: campaignMap.get(d.campaign_id) ?? 'Unknown Campaign',
    amount_cents: d.amount_cents,
    status: d.status,
    payment_method: null,
    anonymous: d.anonymous,
    message: d.message,
    created_at: d.created_at,
  }));

  return (
    <CharitMeShell active="Donations" mode="admin">
      <TopBar
        title="Donations"
        subtitle="Manage donations, donors, and transactions from start to finish."
        actions={
          <Link
            href="/api/exports/donations"
            download
            className="kf-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', fontSize: 13, fontWeight: 900, textDecoration: 'none' }}
          >
            Export CSV
          </Link>
        }
      />
      <DonationsClient
        totalCents={totalCents}
        donorCount={donorCount}
        avgCents={avgCents}
        totalDonationCount={totalDonationCount ?? 0}
        completedCount={completedCount ?? 0}
        pendingCount={pendingCount ?? 0}
        refundedCount={refundedCount ?? 0}
        failedCount={failedCount ?? 0}
        donations={records}
        weeklyTrend={weeklyTrend}
        campaignVolumes={campaignVolumes}
        topDonors={topDonors}
      />
    </CharitMeShell>
  );
}
