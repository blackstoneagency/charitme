import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { formatCents } from '../../lib/stripe';
import { parseRoles } from '../../lib/roles';
import ProfileForm from './ProfileForm';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

async function getProfile(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('full_name, bio, avatar_url, roles, created_at')
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
      .select('amount_cents')
      .eq('donor_id', userId)
      .eq('status', 'completed');
    const total = (data ?? []).reduce((s, d) => s + (d.amount_cents ?? 0), 0);
    return { totalDonated: total, donationCount: (data ?? []).length };
  } catch {
    return { totalDonated: 0, donationCount: 0 };
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
  const [profile, donorStats, campaignStats] = await Promise.all([
    getProfile(user.id),
    getDonorStats(user.id),
    getCampaignStats(user.id),
  ]);

  const roles = parseRoles(profile?.roles);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : null;

  return (
    <div className="bg-white min-h-screen">
      {/* Stats banner */}
      <section className="border-b border-slate-100 bg-slate-50 py-8">
        <div className="container">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total donated', value: formatCents(donorStats.totalDonated) },
              { label: 'Campaigns supported', value: donorStats.donationCount.toString() },
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

      {/* Quick links */}
      <section className="border-b border-slate-100 py-4">
        <div className="container">
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
              Fundraiser Dashboard →
            </Link>
            <Link href="/dashboard/donor" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-blue-300 hover:text-blue-700">
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
        }}
        email={user.email ?? ''}
      />
    </div>
  );
}
