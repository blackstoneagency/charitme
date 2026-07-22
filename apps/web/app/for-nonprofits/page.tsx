import Link from 'next/link';
import type { Metadata } from 'next';
import { PRICING_TIERS } from '../../lib/pricing';
import { seoMetadata } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/for-nonprofits', {
    title: 'For Nonprofits — AI-Powered Fundraising',
    description: 'CharitMe gives nonprofits donor CRM, recurring donations, automated tax receipts, team access, campaign templates, and AI-powered outreach tools.',
    alternates: { canonical: 'https://www.charitme.com/for-nonprofits' },
  });
}

const NONPROFIT_FEATURES = [
  {
    icon: '👥',
    title: 'Donor CRM',
    body: 'Track every donor, donation, contact note, and giving history in one place. Segment by frequency, amount, campaign, or custom tags.',
  },
  {
    icon: '🔄',
    title: 'Recurring donations',
    body: 'Enable monthly, quarterly, or annual giving. Stripe handles the billing automatically. Donors can update or cancel at any time without contacting you.',
  },
  {
    icon: '🧾',
    title: 'Automated tax receipts',
    body: 'CharitMe sends IRS-formatted tax receipts for qualifying donations to verified 501(c)(3) organizations — automatically and at scale.',
  },
  {
    icon: '🏛️',
    title: 'Team access and roles',
    body: 'Invite staff and volunteers with role-based access: admin, editor, viewer. Everyone sees real-time reporting without exposing sensitive payout settings.',
  },
  {
    icon: '📋',
    title: 'Campaign templates',
    body: 'Pre-built campaign templates for annual fund drives, disaster response, capital campaigns, and events — ready to customize in minutes.',
  },
  {
    icon: '📊',
    title: 'Advanced analytics',
    body: 'Donor retention rates, lifetime value, campaign conversion, channel attribution, and recurring giving dashboards — all in real time.',
  },
  {
    icon: '🤖',
    title: 'AI outreach automation',
    body: 'Auto-generate personalized donor thank-you emails, campaign updates, lapsed donor re-engagement messages, and appeal sequences.',
  },
  {
    icon: '🎟️',
    title: 'Event fundraising pages',
    body: 'Create fundraising event pages with goal trackers, donor walls, ticket links, and QR codes for in-person giving.',
  },
];

const NONPROFIT_PLANS = PRICING_TIERS.filter((t) => t.name.startsWith('Nonprofit') || t.name === 'Enterprise');

export default function ForNonprofitsPage() {
  return (
    <div className="mktg-page">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-purple-200 bg-white px-3 py-1 text-sm font-black text-purple-700">
              For nonprofits
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              AI-powered fundraising<br className="hidden sm:block" /> for mission-driven teams.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              CharitMe gives nonprofits a complete fundraising stack — donor CRM, recurring giving, tax receipts,
              team roles, campaign templates, and AI-powered outreach — starting at $29/month.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="rounded-xl bg-purple-700 px-5 py-3 text-sm font-black text-white shadow-soft">
                Talk to our nonprofit team
              </Link>
              <Link href="/create" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                Start a campaign free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-100 py-10">
        <div className="container">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: '0%', label: 'Mandatory platform fee' },
              { value: 'Automated', label: 'Tax receipt delivery' },
              { value: '$29/mo', label: 'Nonprofit Starter plan' },
              { value: 'Unlimited', label: 'Campaigns per plan' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <div className="text-3xl font-black text-purple-700">{s.value}</div>
                <div className="mt-1 text-sm font-bold text-slate-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Everything a fundraising team needs</h2>
            <p className="mt-3 text-slate-600">Built for nonprofits that want to grow recurring revenue, retain donors, and spend less time on manual outreach.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {NONPROFIT_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 text-3xl">{feature.icon}</div>
                <h3 className="font-black text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI tools */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-black uppercase tracking-wide text-purple-700">AI for nonprofits</div>
              <h2 className="text-3xl font-black text-slate-950">Your fundraising team, augmented by AI</h2>
              <p className="mt-4 leading-7 text-slate-600">
                CharitMe AI tools are built for authentic storytelling — not generic templates.
                Generate campaign stories, thank-you sequences, lapsed donor appeals, and grant summaries
                in your organization&apos;s voice.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { title: 'AI Campaign Copilot', desc: 'Turn rough notes into polished, authentic campaign stories optimized for conversion and trust.' },
                  { title: 'AI Donor Outreach', desc: 'Generate personalized thank-you emails, impact summaries, and re-engagement sequences automatically.' },
                  { title: 'AI Social Studio', desc: 'Create social media posts, donation asks, and campaign updates for every major platform.' },
                  { title: 'Campaign Health Score', desc: 'AI evaluates story quality, trust signals, evidence, and outreach timing — then suggests what to fix.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="mt-1 shrink-0 font-black text-purple-600">✓</span>
                    <div>
                      <div className="font-black text-slate-950">{item.title}</div>
                      <div className="text-sm text-slate-600">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-purple-200 bg-purple-50 p-8">
              <div className="text-sm font-black uppercase tracking-wide text-purple-700">Trust for nonprofits</div>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Every nonprofit campaign gets a trust score</h3>
              <p className="mt-3 leading-7 text-slate-600">
                Nonprofit campaigns display the same public AI trust score as individual campaigns —
                with additional signals for 501(c)(3) verification status, recurring donor base, and
                campaign history. Donors see the score, the verification badges, and the evidence you provide.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  'Verified 501(c)(3) badge',
                  'Identity and beneficiary verification',
                  'Transparent payout destination',
                  'Donation transparency ledger',
                  'Post-campaign impact reports',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <span className="font-black text-purple-700">✓</span>
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nonprofit plans */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Nonprofit plans</h2>
            <p className="mt-3 text-slate-600">Verified 501(c)(3) organizations qualify for discounted nonprofit pricing. Contact us to apply.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {NONPROFIT_PLANS.map((tier) => (
              <div
                key={tier.name}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">{tier.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{tier.audience}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-black text-purple-700">{tier.price}</div>
                  </div>
                </div>
                <ul className="mt-6 grow space-y-3 text-sm text-slate-700">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 font-black text-purple-600">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.name === 'Enterprise' ? '/contact' : '/contact'}
                  className="mt-7 block rounded-xl border border-slate-200 py-3 text-center text-sm font-black text-slate-900 hover:border-purple-300 hover:text-purple-700 transition-colors"
                >
                  {tier.name === 'Enterprise' ? 'Contact sales' : 'Get nonprofit pricing'}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-slate-500">
            All nonprofit plans include 0% mandatory platform fee. Verified 501(c)(3) discount applied on request.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-purple-700 py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-black text-white">Ready to modernize your fundraising?</h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-200">
            Talk to our nonprofit team about onboarding, 501(c)(3) verification, discounted pricing, and team setup.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-xl bg-white px-8 py-4 text-sm font-black text-purple-700">
              Talk to our nonprofit team →
            </Link>
            <Link href="/pricing" className="rounded-xl border border-purple-400 px-8 py-4 text-sm font-black text-white">
              Compare all plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
