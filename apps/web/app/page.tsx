import Link from 'next/link';
import { supabaseAdmin } from '../lib/supabase';
import { formatCents } from '../lib/stripe';
import { AI_MOAT_FEATURES, BRAND, GROWTH_PLAYBOOK, TRUST_PILLARS, calculateTrustScore, getTrustStatus } from '../lib/ai-platform';

export const dynamic = 'force-dynamic';

async function getFeaturedCampaigns() {
  try {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status')
      .eq('status', 'active')
      .order('raised_amount', { ascending: false })
      .limit(6);
    return data ?? [];
  } catch {
    return [];
  }
}

async function getStats() {
  try {
    const { data } = await supabaseAdmin.from('campaigns').select('raised_amount, backer_count').eq('status', 'active');
    return {
      total: (data ?? []).reduce((sum, campaign) => sum + (campaign.raised_amount ?? 0), 0),
      donors: (data ?? []).reduce((sum, campaign) => sum + (campaign.backer_count ?? 0), 0),
      count: data?.length ?? 0,
    };
  } catch {
    return { total: 0, donors: 0, count: 0 };
  }
}

export default async function HomePage() {
  const [campaigns, stats] = await Promise.all([getFeaturedCampaigns(), getStats()]);

  return (
    <div className="bg-white">
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              {BRAND.positioning}
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              The safest and smartest way to raise money online.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              GiveRise helps people launch stronger campaigns, prevent fraud, increase donor trust, and receive fast verified payouts through Stripe.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Start free fundraiser
              </Link>
              <Link href="/trust-safety" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950">
                See trust system
              </Link>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ['Active campaigns', stats.count.toLocaleString()],
                ['Donor signals', stats.donors.toLocaleString()],
                ['Raised so far', formatCents(stats.total)],
                ['Mandatory platform fee', '0%'],
                ['Default optional tip', '8%'],
                ['Standard payout', 'Free'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <div className="text-2xl font-black text-emerald-700">{value}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black text-emerald-700">AI trust preview</div>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Donor confidence before the ask</h2>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Built-in trust</div>
            </div>
            <div className="mt-6 space-y-3">
              {TRUST_PILLARS.slice(0, 5).map((pillar) => (
                <div key={pillar} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">✓</div>
                  <div className="text-sm font-bold text-slate-800">{pillar}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Everything donors need to feel safe giving.</h2>
            <p className="mt-3 text-slate-600">Transparent pricing, AI trust score, fraud prevention, fast payouts, and an impact ledger are first-class product features.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {AI_MOAT_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 h-2 w-14 rounded-full bg-emerald-500" />
                <h3 className="text-lg font-black text-slate-950">{feature.title}</h3>
                <p className="mt-3 text-sm font-semibold text-slate-500">{feature.complaint}</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">{feature.solution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-black text-slate-950">AI helps campaigns raise more.</h2>
            <p className="mt-3 text-slate-600">GiveRise actively coaches organizers after launch instead of leaving campaigns to go quiet.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {GROWTH_PLAYBOOK.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-sm">{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-950">Trusted campaigns</h2>
              <p className="mt-2 text-slate-600">A donor-first campaign marketplace with public trust signals.</p>
            </div>
            <Link href="/campaigns" className="text-sm font-black text-emerald-700">Browse all</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const score = calculateTrustScore(campaign);
              const pct = Math.min(100, Math.round(((campaign.raised_amount ?? 0) / campaign.goal_amount) * 100));
              return (
                <Link key={campaign.id} href={`/campaigns/${campaign.slug}`} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-44 bg-gradient-to-br from-emerald-100 to-blue-100" style={campaign.cover_image_url ? { background: `url(${campaign.cover_image_url}) center/cover` } : undefined} />
                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{campaign.category}</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">{getTrustStatus(score)}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-950">{campaign.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{campaign.tagline}</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="font-black text-emerald-700">{formatCents(campaign.raised_amount ?? 0)}</span>
                      <span className="font-semibold text-slate-500">{campaign.backer_count ?? 0} donors</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {campaigns.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <h3 className="text-xl font-black text-slate-950">No campaigns yet</h3>
              <p className="mt-2 text-slate-600">Seed data or publish your first GiveRise campaign to populate this section.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
