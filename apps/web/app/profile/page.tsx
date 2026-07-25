import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { formatCents } from '../../lib/stripe';
import { parseRoles } from '../../lib/roles';
import { DONOR_BADGES, computeMonthlyStreak, getGivingLevel, type DonorStats } from '../../lib/gamification';
import ProfileForm from './ProfileForm';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Profile', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

async function getProfile(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('full_name, bio, avatar_url, roles, created_at, notification_email, notification_updates, notification_marketing')
      .eq('id', userId)
      .single();
    return data;
  } catch {
    return null;
  }
}

async function getDonorStats(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('donations')
      .select('amount_cents, campaign_id, created_at')
      .eq('donor_id', userId)
      .eq('status', 'completed');
    const rows = data ?? [];
    const total = rows.reduce((s, d) => s + (d.amount_cents ?? 0), 0);
    const campaignCount = new Set(rows.map((d) => d.campaign_id)).size;
    const donationDates = rows.map((d) => d.created_at as string);
    return { totalDonated: total, donationCount: rows.length, campaignCount, donationDates };
  } catch {
    return { totalDonated: 0, donationCount: 0, campaignCount: 0, donationDates: [] as string[] };
  }
}

async function hasActiveRecurring(userId: string): Promise<boolean> {
  try {
    const { count } = await supabaseAdmin
      .from('recurring_donations')
      .select('id', { count: 'exact', head: true })
      .eq('donor_id', userId)
      .eq('status', 'active');
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

async function getCampaignStats(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id, raised_amount, status')
      .eq('user_id', userId);
    const total = (data ?? []).reduce((s, c) => s + (c.raised_amount ?? 0), 0);
    return { totalRaised: total, campaignCount: (data ?? []).length, activeCampaigns: (data ?? []).filter((c) => c.status === 'active').length };
  } catch {
    return { totalRaised: 0, campaignCount: 0, activeCampaigns: 0 };
  }
}

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, donorStats, campaignStats, recurring] = await Promise.all([
    getProfile(user.id),
    getDonorStats(user.id),
    getCampaignStats(user.id),
    hasActiveRecurring(user.id),
  ]);

  const roles = parseRoles(profile?.roles);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : null;

  const monthStreak = computeMonthlyStreak(donorStats.donationDates);
  const level = getGivingLevel(donorStats.totalDonated);
  const gamificationStats: DonorStats = {
    donationCount: donorStats.donationCount,
    totalCents: donorStats.totalDonated,
    campaignCount: donorStats.campaignCount,
    hasRecurring: recurring,
    monthStreak,
  };
  const earnedBadgeIds = new Set(DONOR_BADGES.filter((b) => b.earned(gamificationStats)).map((b) => b.id));

  return (
    <div className="mktg-page min-h-screen">
      {/* Stats banner */}
      <section className="border-b border-slate-100 bg-slate-50 py-8">
        <div className="container">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total donated', value: formatCents(donorStats.totalDonated) },
              { label: 'Campaigns supported', value: donorStats.campaignCount.toString() },
              { label: 'Campaigns created', value: campaignStats.campaignCount.toString() },
              { label: 'Member since', value: memberSince ?? '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-2xl font-black text-slate-950">{s.value}</div>
                <div className="mt-1 text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Giving level + badges */}
      {donorStats.donationCount > 0 && (
        <section className="border-b border-slate-100 py-8">
          <div className="container">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                <div className="text-sm font-bold text-slate-500">Giving Level</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="text-4xl">{level.current.icon}</div>
                  <div>
                    <div className="text-xl font-black text-slate-950">{level.current.name}</div>
                    <div className="text-xs text-slate-500">{formatCents(donorStats.totalDonated)} given</div>
                  </div>
                </div>
                {level.next ? (
                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${level.progress}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {formatCents(level.remainingCents)} more to reach{' '}
                      <span className="font-bold text-slate-700">{level.next.icon} {level.next.name}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-xs font-bold text-emerald-600">🎉 You&apos;ve reached the top giving level!</div>
                )}
                {monthStreak >= 2 && (
                  <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                    🔥 {monthStreak}-month giving streak
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="text-sm font-bold text-slate-500">Badges</div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {DONOR_BADGES.map((b) => {
                    const earned = earnedBadgeIds.has(b.id);
                    return (
                      <div
                        key={b.id}
                        title={b.description}
                        className={`rounded-xl border p-3 text-center ${earned ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50 opacity-50 grayscale'}`}
                      >
                        <div className="text-2xl">{b.icon}</div>
                        <div className="mt-1 text-xs font-bold text-slate-700">{b.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="border-b border-slate-100 py-4">
        <div className="container">
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
              Fundraiser Dashboard →
            </Link>
            <Link href="/donor" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-blue-300 hover:text-blue-700">
              Donation History →
            </Link>
            {roles.includes('admin') && (
              <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-red-300 hover:text-red-700">
                Admin Panel →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Profile form */}
      <ProfileForm
        profile={{
          full_name: profile?.full_name ?? null,
          bio: profile?.bio ?? null,
          avatar_url: profile?.avatar_url ?? null,
          roles,
          notification_email: profile?.notification_email ?? true,
          notification_updates: profile?.notification_updates ?? true,
          notification_marketing: profile?.notification_marketing ?? false,
        }}
        email={user.email ?? ''}
      />
    </div>
  );
}
