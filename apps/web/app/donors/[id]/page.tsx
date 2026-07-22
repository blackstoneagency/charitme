import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatCents } from '../../../lib/stripe';
import { DONOR_BADGES, computeMonthlyStreak, getGivingLevel, type DonorStats } from '../../../lib/gamification';
import { getCoverForCampaign } from '../../../lib/photo-catalog';
import type { Metadata } from 'next';
import { seoMetadata } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  show_public_profile: boolean | null;
  created_at: string;
};

type CampaignRow = { id: string; title: string; slug: string; cover_image_url: string | null; category: string };

async function getProfile(id: string): Promise<ProfileRow | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, avatar_url, bio, show_public_profile, created_at')
    .eq('id', id)
    .maybeSingle();
  return data as ProfileRow | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  const name = profile?.full_name || 'Donor';
  if (!profile || profile.show_public_profile === false) {
    return { title: `${name} · Donor Profile`, robots: { index: false, follow: false } };
  }
  return seoMetadata(`/donors/${id}`, {
    title: `${name} · Donor Profile`,
    description: `See ${name}'s giving activity, badges, and supported campaigns on CharitMe.`,
    alternates: { canonical: `https://www.charitme.com/donors/${id}` },
  });
}

export default async function PublicDonorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();

  if (profile.show_public_profile === false) {
    return (
      <div className="mktg-page min-h-screen">
        <div className="container py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">🔒</div>
          <h1 className="mt-4 text-xl font-black text-slate-950">This donor profile is private</h1>
          <p className="mt-2 text-sm text-slate-500">This donor has chosen not to share their giving activity publicly.</p>
          <Link href="/leaderboard" className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700">
            ← Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const { data: donationData } = await supabaseAdmin
    .from('donations')
    .select('amount_cents, campaign_id, created_at')
    .eq('donor_id', id)
    .eq('status', 'completed')
    .eq('anonymous', false)
    .order('created_at', { ascending: false })
    .limit(200);

  const donations = donationData ?? [];
  const totalDonated = donations.reduce((s, d) => s + (d.amount_cents ?? 0), 0);
  const campaignIds = [...new Set(donations.map((d) => d.campaign_id).filter(Boolean) as string[])];
  const donationDates = donations.map((d) => d.created_at as string);

  const { count: activeRecurringCount } = await supabaseAdmin
    .from('recurring_donations')
    .select('id', { count: 'exact', head: true })
    .eq('donor_id', id)
    .eq('status', 'active');

  const campaignMap = new Map<string, CampaignRow>();
  if (campaignIds.length > 0) {
    const { data: camps } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug, cover_image_url, category')
      .in('id', campaignIds)
      .eq('visibility', 'public')
      .is('deleted_at', null);
    for (const c of (camps ?? []) as CampaignRow[]) campaignMap.set(c.id, c);
  }

  const recentCampaignIds = [...new Set(donations.map((d) => d.campaign_id).filter(Boolean) as string[])].slice(0, 6);

  const monthStreak = computeMonthlyStreak(donationDates);
  const level = getGivingLevel(totalDonated);
  const gamificationStats: DonorStats = {
    donationCount: donations.length,
    totalCents: totalDonated,
    campaignCount: campaignIds.length,
    hasRecurring: (activeRecurringCount ?? 0) > 0,
    monthStreak,
  };
  const earnedBadgeIds = new Set(DONOR_BADGES.filter((b) => b.earned(gamificationStats)).map((b) => b.id));

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const name = profile.full_name || 'Generous Donor';

  return (
    <div className="mktg-page min-h-screen">
      {/* Header */}
      <section className="border-b border-slate-100 bg-slate-50 py-10">
        <div className="container">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-2xl font-black text-white"
              style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            >
              {!profile.avatar_url && name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">{name}</h1>
              <div className="mt-1 text-sm text-slate-500">Member since {memberSince}</div>
            </div>
            <div className="ml-auto hidden text-3xl sm:block" title={level.current.name}>{level.current.icon}</div>
          </div>
          {profile.bio && <p className="mt-4 max-w-2xl text-sm text-slate-600">{profile.bio}</p>}
        </div>
      </section>

      {donations.length === 0 ? (
        <div className="container py-16 text-center">
          <p className="text-sm text-slate-500">This donor hasn&apos;t made any public donations yet.</p>
          <Link href="/leaderboard" className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700">
            ← Back to Leaderboard
          </Link>
        </div>
      ) : (
        <>
          {/* Stats banner */}
          <section className="border-b border-slate-100 py-8">
            <div className="container">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Total donated', value: formatCents(totalDonated) },
                  { label: 'Donations made', value: donations.length.toString() },
                  { label: 'Campaigns supported', value: campaignIds.length.toString() },
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
          <section className="border-b border-slate-100 py-8">
            <div className="container">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                  <div className="text-sm font-bold text-slate-500">Giving Level</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="text-4xl">{level.current.icon}</div>
                    <div>
                      <div className="text-xl font-black text-slate-950">{level.current.name}</div>
                      <div className="text-xs text-slate-500">{formatCents(totalDonated)} given</div>
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
                    <div className="mt-4 text-xs font-bold text-emerald-600">🎉 Reached the top giving level!</div>
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

          {/* Recently supported campaigns */}
          {recentCampaignIds.length > 0 && (
            <section className="py-8">
              <div className="container">
                <h2 className="text-sm font-bold text-slate-500">Recently Supported</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {recentCampaignIds.map((cid) => {
                    const c = campaignMap.get(cid);
                    if (!c) return null;
                    return (
                      <Link key={c.id} href={`/campaigns/${c.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                        <div className="h-28 w-full bg-slate-100 bg-cover bg-center" style={{ backgroundImage: `url(${c.cover_image_url || getCoverForCampaign(c.category, c.slug)})` }} />
                        <div className="p-3">
                          <div className="text-sm font-black text-slate-950 group-hover:text-emerald-700">{c.title}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
