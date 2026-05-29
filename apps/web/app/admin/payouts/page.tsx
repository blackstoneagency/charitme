import 'server-only';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import PayoutsClient, { type PayoutRecord, type WeekPoint, type TopRecipient } from './_components/PayoutsClient';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  await requireAdmin();

  type RawPayout = {
    id: string;
    campaign_id: string;
    user_id: string;
    amount_cents: number;
    payout_speed: string | null;
    status: string;
    created_at: string;
  };

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [
    { data: payouts },
    { data: paidAmounts },
    { data: pendingAmounts },
    { count: pendingCount },
    { count: completedCount },
    { count: failedCount },
    { data: trendData },
  ] = await Promise.all([
    supabaseAdmin
      .from('payouts')
      .select('id,campaign_id,user_id,amount_cents,payout_speed,status,created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin.from('payouts').select('amount_cents').eq('status', 'paid'),
    supabaseAdmin.from('payouts').select('amount_cents').in('status', ['requested', 'approved', 'pending']),
    supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).in('status', ['requested', 'approved', 'pending']),
    supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
    supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabaseAdmin
      .from('payouts')
      .select('amount_cents,created_at')
      .gte('created_at', eightWeeksAgo.toISOString())
      .order('created_at', { ascending: true }),
  ]);

  const payoutList = (payouts ?? []) as RawPayout[];
  const totalCents = (paidAmounts ?? []).reduce((s, p) => s + ((p as { amount_cents: number }).amount_cents ?? 0), 0);
  const pendingCents = (pendingAmounts ?? []).reduce((s, p) => s + ((p as { amount_cents: number }).amount_cents ?? 0), 0);

  // Resolve campaign titles
  const campaignIds = [...new Set(payoutList.map(p => p.campaign_id).filter(Boolean))];
  const campaignMap = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin.from('campaigns').select('id,title').in('id', campaignIds);
    for (const c of (campaigns ?? []) as { id: string; title: string }[]) {
      campaignMap.set(c.id, c.title);
    }
  }

  // Resolve organizer profiles
  const userIds = [...new Set(payoutList.map(p => p.user_id).filter(Boolean))];
  const profileMap = new Map<string, { name: string; email: string }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id,full_name').in('id', userIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      profileMap.set(p.id, { name: p.full_name ?? 'Unknown', email: '' });
    }
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      for (const u of authData?.users ?? []) {
        const existing = profileMap.get(u.id);
        if (existing) profileMap.set(u.id, { ...existing, email: u.email ?? '' });
      }
    } catch { /* ignore */ }
  }

  // Weekly trend
  const weekMap = new Map<string, number>();
  for (const p of (trendData ?? []) as { amount_cents: number; created_at: string }[]) {
    const date = new Date(p.created_at);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const key = monday.toISOString().slice(0, 10);
    weekMap.set(key, (weekMap.get(key) ?? 0) + (p.amount_cents ?? 0));
  }
  const weeklyTrend: WeekPoint[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, total_cents]) => ({ week, total_cents }));

  // Top recipients
  const recipientMap = new Map<string, number>();
  for (const p of payoutList) {
    recipientMap.set(p.user_id, (recipientMap.get(p.user_id) ?? 0) + p.amount_cents);
  }
  const topRecipients: TopRecipient[] = [...recipientMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, total_cents]) => ({
      id,
      name: profileMap.get(id)?.name ?? 'Unknown',
      total_cents,
    }));

  // Build records
  const records: PayoutRecord[] = payoutList.map(p => ({
    id: p.id,
    recipient_name: profileMap.get(p.user_id)?.name ?? 'Unknown Organizer',
    recipient_email: profileMap.get(p.user_id)?.email ?? '',
    campaign_title: campaignMap.get(p.campaign_id) ?? 'Unknown Campaign',
    amount_cents: p.amount_cents,
    status: p.status,
    payout_method: p.payout_speed ? p.payout_speed.replace(/_/g, ' ') : 'Bank Transfer',
    note: null,
    created_at: p.created_at,
    paid_at: p.status === 'paid' ? p.created_at : null,
  }));

  return (
    <KindFundShell active="Payouts" mode="admin">
      <TopBar
        title="Payouts"
        subtitle="Manage payout requests, review details, and take action."
        actions={<></>}
      />
      <PayoutsClient
        totalCents={totalCents}
        pendingCents={pendingCents}
        completedCents={totalCents}
        failedCount={failedCount ?? 0}
        pendingCount={pendingCount ?? 0}
        completedCount={completedCount ?? 0}
        payouts={records}
        weeklyTrend={weeklyTrend}
        topRecipients={topRecipients}
      />
    </KindFundShell>
  );
}
