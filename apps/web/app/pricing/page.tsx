import Link from 'next/link';
import type { Metadata } from 'next';
import { PRICING_TIERS, PAYOUT_OPTIONS } from '../../lib/pricing';

export const metadata: Metadata = {
  title: 'Pricing',
  description: '0% mandatory platform fee. Optional donor tips. Start free — upgrade only when AI growth creates real value.',
};

const PRICING_FAQ = [
  { q: 'Does GiveRise charge a platform fee?', a: 'No. The mandatory platform fee is 0%. We earn only if donors voluntarily add an optional support tip at checkout (default 8%, always editable including to $0).' },
  { q: 'What does Stripe charge?', a: 'Standard card processing is 2.9% + $0.30 per transaction, charged by Stripe. Donors can optionally cover this fee at checkout so 100% of their intended donation reaches the campaign.' },
  { q: 'When do I need a paid plan?', a: 'Never, to run campaigns and receive donations. Paid plans unlock AI copilot tools, advanced analytics, donor CRM, recurring donations, and priority support.' },
  { q: 'Are there payout fees?', a: 'Standard payouts are always free. Same-day (1%) and instant (1.5%) payouts are optional speed upgrades for eligible verified users only.' },
  { q: 'Can nonprofits get a discount?', a: 'Yes. Contact us for verified 501(c)(3) pricing. Nonprofit plans include donor CRM, recurring donations, and automated tax receipt emails.' },
  { q: 'What happens if I cancel a paid plan?', a: 'Your campaigns stay live and keep accepting donations. All data is preserved. AI features and advanced tools are paused until you re-subscribe.' },
];

export default function PricingPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              Transparent pricing
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              0% platform fee.<br className="hidden sm:block" /> Always.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              GiveRise is free to start, free to run, and completely transparent about every dollar before checkout.
              We earn only from optional donor support tips — never from fundraisers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Start free campaign
              </Link>
              <Link href="/how-it-works" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                How it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fee breakdown */}
      <section className="py-16">
        <div className="container">
          <h2 className="mb-10 text-3xl font-black text-slate-950">Every fee, fully explained</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                label: 'Platform fee',
                value: '0%',
                description: 'GiveRise charges nothing mandatory. Zero. Always.',
                color: 'text-emerald-700',
                bg: 'bg-emerald-50 border-emerald-200',
              },
              {
                label: 'Stripe processing',
                value: '2.9% + $0.30',
                description: 'Standard card processing charged by Stripe, not GiveRise. Donors can optionally cover this at checkout.',
                color: 'text-blue-700',
                bg: 'bg-blue-50 border-blue-200',
              },
              {
                label: 'Optional donor tip',
                value: '0–12%',
                description: 'Donors can optionally tip GiveRise to support the platform. Default is 8%. Always editable, always optional.',
                color: 'text-slate-700',
                bg: 'bg-slate-50 border-slate-200',
              },
            ].map((item) => (
              <div key={item.label} className={`rounded-3xl border p-8 ${item.bg}`}>
                <div className={`text-4xl font-black sm:text-5xl ${item.color}`}>{item.value}</div>
                <div className="mt-3 text-lg font-black text-slate-950">{item.label}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Plans for every fundraising motion</h2>
            <p className="mt-3 text-slate-600">
              Start free. Upgrade only when AI growth tools, nonprofit workflows, or enterprise giving create clear value.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`flex flex-col rounded-3xl border p-7 shadow-sm ${
                  tier.highlighted
                    ? 'border-emerald-300 bg-white ring-2 ring-emerald-500 ring-offset-2'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {tier.highlighted && (
                  <div className="mb-4 self-start rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                    Most popular
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">{tier.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{tier.audience}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-black text-emerald-700">{tier.price}</div>
                  </div>
                </div>
                <ul className="mt-6 grow space-y-3 text-sm text-slate-700">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 font-black text-emerald-600">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.name === 'Enterprise' ? '/contact' : '/create'}
                  className={`mt-7 block rounded-xl py-3 text-center text-sm font-black transition-colors ${
                    tier.highlighted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-slate-200 text-slate-900 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {tier.price === '$0' ? 'Start free' : tier.name === 'Enterprise' ? 'Contact us' : 'Get started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payout options */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Payout speed options</h2>
            <p className="mt-3 text-slate-600">
              Standard payouts are always free. Faster options are available for eligible verified users through Stripe Connect.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 text-left font-black text-slate-700">Payout type</th>
                  <th className="px-6 py-4 text-left font-black text-slate-700">Fee</th>
                  <th className="px-6 py-4 text-left font-black text-slate-700">Availability</th>
                </tr>
              </thead>
              <tbody>
                {PAYOUT_OPTIONS.map((opt, i) => (
                  <tr key={opt.name} className={i < PAYOUT_OPTIONS.length - 1 ? 'border-b border-slate-100' : ''}>
                    <td className="px-6 py-4 font-black text-slate-950">{opt.name}</td>
                    <td className="px-6 py-4 font-black text-emerald-700">{opt.fee}</td>
                    <td className="px-6 py-4 text-slate-600">{opt.availability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            * Payout eligibility is determined by Stripe verification status, account age, and risk score.
            Instant payouts require low-risk verified accounts only.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <h2 className="mb-10 text-3xl font-black text-slate-950">Pricing FAQ</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {PRICING_FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-black text-slate-950">{item.q}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container">
          <div className="rounded-3xl bg-emerald-600 px-8 py-14 text-center">
            <h2 className="text-3xl font-black text-white">Start free. No credit card required.</h2>
            <p className="mx-auto mt-4 max-w-xl text-emerald-100">
              Every campaign is free to create and free to run. Upgrade only when AI growth tools and nonprofit workflows make sense for your team.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/create" className="rounded-xl bg-white px-8 py-4 text-sm font-black text-emerald-700 shadow-soft">
                Create your campaign →
              </Link>
              <Link href="/contact" className="rounded-xl border border-emerald-400 px-8 py-4 text-sm font-black text-white">
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
