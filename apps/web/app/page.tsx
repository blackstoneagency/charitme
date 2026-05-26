import Link from 'next/link';
import { supabaseAdmin } from '../lib/supabase';
import { formatCents } from '../lib/stripe';
import { calculateTrustScore } from '../lib/ai-platform';

export const dynamic = 'force-dynamic';
const BUILD_TIME = Date.now();

async function getFeaturedCampaigns() {
  try {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, identity_verified, stripe_onboarded')
      .eq('status', 'active')
      .order('raised_amount', { ascending: false })
      .limit(6);
    return data ?? [];
  } catch {
    return [];
  }
}

async function getHeroCampaign() {
  try {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, goal_amount, raised_amount, backer_count, deadline, identity_verified, stripe_onboarded, cover_image_url')
      .eq('status', 'active')
      .order('raised_amount', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

const HERO_FEATURES = [
  { icon: '✏️', label: 'AI Campaign Builder' },
  { icon: '🚀', label: 'AI Growth Engine' },
  { icon: '🛡️', label: 'AI Trust & Safety' },
  { icon: '💬', label: '24/7 AI Support' },
];

const AI_FEATURES = [
  {
    icon: '✏️',
    title: 'AI Campaign Builder',
    body: 'Create a powerful campaign in minutes with our AI assistant.',
  },
  {
    icon: '🚀',
    title: 'AI Growth Engine',
    body: 'Our AI finds your ideal donors and grows your campaign automatically.',
  },
  {
    icon: '🛡️',
    title: 'AI Trust & Safety',
    body: 'Advanced verification protects donors and builds trust from day one.',
  },
  {
    icon: '📊',
    title: 'AI Optimization',
    body: 'Real-time insights and AI recommendations to maximize your results.',
  },
  {
    icon: '❤️',
    title: 'AI Impact Updates',
    body: 'Automatically share updates and show donors the real world impact.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'GiveRise\'s AI helped us raise 3x more than we ever thought possible. The support was incredible.',
    name: 'James R.',
    role: 'Father & Organizer',
    raised: '$78,543',
    initials: 'JR',
  },
  {
    quote: 'The transparency and updates kept our donors engaged the entire way. Best experience ever.',
    name: 'Melissa K.',
    role: 'Nonprofit Director',
    raised: '$120,890',
    initials: 'MK',
  },
  {
    quote: 'The AI Growth Engine found donors I didn\'t even know existed. Game changer.',
    name: 'David L.',
    role: 'Community Leader',
    raised: '$56,230',
    initials: 'DL',
  },
];

const TRUST_BULLETS = [
  'Industry-leading Trust Score',
  'Real-time fraud detection',
  'Bank-level security',
  'Transparent impact tracking',
];

const PRESS = ['Forbes', 'Fast Company', 'TechCrunch', 'The New York Times', 'USA Today'];

export default async function HomePage() {
  const [campaigns, heroCampaign] = await Promise.all([getFeaturedCampaigns(), getHeroCampaign()]);

  const heroTitle = heroCampaign?.title ?? 'Help Mia Get Life-Saving Heart Surgery';
  const heroRaised = heroCampaign?.raised_amount ?? 2435000;
  const heroGoal = heroCampaign?.goal_amount ?? 5000000;
  const heroDonors = heroCampaign?.backer_count ?? 487;
  const heroPct = Math.min(100, Math.round((heroRaised / heroGoal) * 100));
  const heroSlug = heroCampaign?.slug ?? 'create';
  const heroVerified = heroCampaign?.identity_verified ?? true;
  const heroDaysLeft = heroCampaign?.deadline
    ? Math.max(0, Math.ceil((new Date(heroCampaign.deadline).getTime() - BUILD_TIME) / 86_400_000))
    : 32;
  const heroScore = heroCampaign ? calculateTrustScore(heroCampaign) : 94;

  return (
    <div className="bg-white">

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="hero-mesh border-b border-violet-100 py-16 sm:py-24">
        <div className="container grid items-center gap-12 lg:grid-cols-[1.1fr_.95fr]">

          {/* Left */}
          <div>
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-1.5 text-sm font-bold text-violet-700 shadow-sm">
              <span className="text-violet-500">✦</span>
              The World&apos;s #1 AI Fundraising Platform
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Fundraising that{' '}
              <em className="not-italic" style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>thinks</em>
              {' '}for you.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Create, grow, and succeed with the power of AI.<br />
              More trust. More donors. More impact.
            </p>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/create"
                className="rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-black text-white shadow-soft transition hover:bg-violet-700"
              >
                Start Your Fundraiser
              </Link>
              <Link
                href="/how-it-works"
                className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-7 py-3.5 text-sm font-black text-slate-800 transition hover:border-violet-300"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-xs text-violet-700">▶</span>
                See How It Works
              </Link>
            </div>

            {/* Feature tags */}
            <div className="mt-8 flex flex-wrap gap-3">
              {HERO_FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                  <span>{f.icon}</span> {f.label}
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="mt-6 flex items-center gap-3">
              {/* Avatar stack */}
              <div className="flex -space-x-2">
                {['bg-violet-200', 'bg-pink-200', 'bg-blue-200', 'bg-amber-200', 'bg-emerald-200'].map((bg, i) => (
                  <div key={i} className={`h-8 w-8 rounded-full border-2 border-white ${bg}`} />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm font-black text-slate-950">
                  <span className="text-amber-400">★★★★★</span>
                  <span className="ml-1">4.9/5</span>
                </div>
                <div className="text-xs text-slate-500">Trusted by millions · 50,000+ reviews</div>
              </div>
            </div>
          </div>

          {/* Right — Campaign card + floating stats */}
          <div className="relative">
            {/* Floating stats — right edge */}
            <div className="absolute -right-3 top-4 z-10 flex flex-col gap-2 sm:-right-6">
              {[
                { icon: '🛡️', label: 'Trust Score', value: String(heroScore), sub: 'Excellent' },
                { icon: '👥', label: 'Donors', value: heroDonors.toLocaleString(), sub: '' },
                { icon: '📤', label: 'Shares', value: '2.4K', sub: '' },
                { icon: '🔔', label: 'Real-time', value: 'Impact', sub: 'Updates' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-md" style={{ minWidth: '88px' }}>
                  <div className="text-lg">{s.icon}</div>
                  <div className="text-sm font-black text-slate-950">{s.value}</div>
                  <div className="text-[10px] text-slate-500 leading-tight">{s.label}{s.sub && <><br />{s.sub}</>}</div>
                </div>
              ))}
            </div>

            {/* Main campaign card */}
            <div className="mr-20 sm:mr-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
              {/* Cover image placeholder */}
              <div className="relative h-48 bg-gradient-to-br from-violet-100 via-purple-50 to-pink-100">
                <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-30">🙏</div>
                {heroVerified && (
                  <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white">
                    ✓ VERIFIED CAMPAIGN
                  </div>
                )}
              </div>

              <div className="p-5">
                <h3 className="text-lg font-black text-slate-950 leading-tight">{heroTitle}</h3>
                <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <span>Organized by GiveRise Organizer</span>
                  {heroVerified && <span className="text-violet-600">✓</span>}
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-black text-slate-950">{formatCents(heroRaised)} <span className="font-normal text-slate-500">raised</span></span>
                    <span className="text-slate-500">{formatCents(heroGoal)} goal</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${heroPct}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  <span className="font-bold text-slate-700">{heroDonors.toLocaleString()} donations</span>
                  <span>{heroDaysLeft} days left</span>
                </div>

                <Link
                  href={`/campaigns/${heroSlug}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white transition hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  ❤️ Donate Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI WORKS. YOU WIN. ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="container">
          <h2 className="mb-12 text-center text-3xl font-black text-slate-950 sm:text-4xl">
            AI Works. You Win.
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {AI_FEATURES.map((feature) => (
              <div key={feature.title} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-violet-200 hover:shadow-md">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl">
                  {feature.icon}
                </div>
                <h3 className="font-black text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{feature.body}</p>
                <div className="mt-4 text-xs font-black text-violet-600 group-hover:underline">
                  Learn more →
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ────────────────────────────────────────────────────── */}
      <section className="border-y border-violet-100 bg-white py-10">
        <div className="container">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { value: '$2.8B+', label: 'Raised on GiveRise' },
              { value: '8M+', label: 'Successful Campaigns' },
              { value: '50M+', label: 'Donors Worldwide' },
              { value: '98%', label: 'Trust Score Average' },
              { value: '195', label: 'Countries Supported' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-black text-violet-600 sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm font-bold text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TRUST + TESTIMONIALS ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[420px_1fr]">
            {/* Left */}
            <div>
              <div className="mb-3 text-xs font-black uppercase tracking-widest text-violet-600">More than a platform</div>
              <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">
                A movement powered<br />by trust and technology.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                We combine human compassion with artificial intelligence to help more people succeed and more good happen in the world.
              </p>
              <ul className="mt-6 space-y-3">
                {TRUST_BULLETS.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs text-violet-700">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/trust-safety" className="mt-6 inline-block text-sm font-black text-violet-700">
                Our Trust Promise →
              </Link>
            </div>

            {/* Right — testimonials */}
            <div className="grid gap-4 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div>
                    <div className="mb-4 text-3xl text-violet-300">&ldquo;</div>
                    <p className="text-sm leading-6 text-slate-700">{t.quote}</p>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.role}</div>
                      <div className="text-xs font-black text-violet-600">Raised {t.raised}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Press logos */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-8 border-t border-slate-100 pt-10">
            {PRESS.map((name) => (
              <div key={name} className="text-base font-black tracking-tight text-slate-300 sm:text-lg">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURED CAMPAIGNS ───────────────────────────────────────────── */}
      {campaigns.length > 0 && (
        <section className="bg-slate-50 py-16">
          <div className="container">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-950">Trusted campaigns</h2>
                <p className="mt-2 text-slate-600">A donor-first campaign marketplace with public trust signals.</p>
              </div>
              <Link href="/campaigns" className="text-sm font-black text-violet-700">Browse all →</Link>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => {
                const score = calculateTrustScore(campaign);
                const pct = Math.min(100, Math.round(((campaign.raised_amount ?? 0) / campaign.goal_amount) * 100));
                return (
                  <Link key={campaign.id} href={`/campaigns/${campaign.slug}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                    <div
                      className="h-44 bg-gradient-to-br from-violet-100 to-purple-50"
                      style={campaign.cover_image_url ? { background: `url(${campaign.cover_image_url}) center/cover` } : undefined}
                    />
                    <div className="p-5">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{campaign.category}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${score >= 88 ? 'bg-emerald-100 text-emerald-700' : score >= 70 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                          {score >= 88 ? 'Verified' : score >= 70 ? 'Strong Trust' : 'Needs More Info'}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-950 group-hover:text-violet-700 transition">{campaign.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{campaign.tagline}</p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }} />
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <span className="font-black text-violet-700">{formatCents(campaign.raised_amount ?? 0)}</span>
                        <span className="font-semibold text-slate-500">{campaign.backer_count ?? 0} donors</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── THE FUTURE SECTION ───────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)' }} className="py-16 sm:py-24">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
            {/* Left */}
            <div>
              <h2 className="text-3xl font-black text-white sm:text-4xl">
                The future of fundraising<br />is intelligent.
              </h2>
              <p className="mt-4 max-w-md leading-7 text-violet-200">
                GiveRise&apos;s AI works behind the scenes so you can focus on what matters most — your mission.
              </p>
            </div>

            {/* Right — 3 icons */}
            <div className="relative flex items-center justify-around gap-4">
              {[
                { icon: '✦', label: 'Smarter Campaigns', desc: 'AI creates and optimizes for maximum impact.' },
                { icon: '👥', label: 'Stronger Connections', desc: 'AI matches you with the right supporters.' },
                { icon: '❤️', label: 'Bigger Impact', desc: 'AI helps you change more lives.' },
              ].map((item, i) => (
                <div key={item.label} className="flex flex-col items-center text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl ${i === 0 ? 'bg-violet-400' : i === 1 ? 'bg-violet-500' : 'bg-pink-400'}`}>
                    {item.icon}
                  </div>
                  <div className="mt-3 text-sm font-black text-white">{item.label}</div>
                  <div className="mt-1 max-w-[120px] text-xs text-violet-300 leading-4">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ───────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }} className="py-16">
        <div className="container">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div>
              <h2 className="text-2xl font-black text-white sm:text-3xl">
                Ready to turn your story into impact?
              </h2>
              <p className="mt-2 text-violet-200">
                Join millions of fundraisers who are reaching their goals with AI.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/create"
                className="rounded-xl bg-white px-7 py-3.5 text-sm font-black text-violet-700 transition hover:bg-violet-50"
              >
                Start Your Fundraiser
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border-2 border-white/40 px-7 py-3.5 text-sm font-black text-white transition hover:border-white"
              >
                Talk to an Expert
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
