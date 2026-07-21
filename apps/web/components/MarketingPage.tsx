import Link from 'next/link';
import { PRICING_TIERS, PAYOUT_OPTIONS } from '../lib/pricing';
import type { MarketingPage as MarketingPageContent } from '../lib/marketing';

export function MarketingPage({ page }: { page: MarketingPageContent }) {
  const showPricing = page.slug === 'pricing';
  const showPayouts = page.slug === 'fast-payouts';

  return (
    <div className="bg-white">
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-bold text-emerald-700">
              {page.eyebrow}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">{page.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{page.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create/choose-path" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-soft">
                {page.cta}
              </Link>
              <Link href="/campaigns" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900">
                Browse campaigns
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {page.points.map((point) => (
              <div key={point} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 h-2 w-12 rounded-full bg-emerald-500" />
                <p className="text-sm font-bold leading-6 text-slate-800">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {showPricing && (
        <section className="bg-slate-50 py-14">
          <div className="container">
            <div className="mb-8 max-w-2xl">
              <h2 className="text-3xl font-black text-slate-950">Plans for every fundraising motion</h2>
              <p className="mt-2 text-slate-600">Start free. Upgrade only when AI growth, nonprofit workflows, or enterprise giving create clear value.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {PRICING_TIERS.map((tier) => (
                <div key={tier.name} className={`rounded-2xl border p-6 shadow-sm ${tier.highlighted ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-950">{tier.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{tier.audience}</p>
                    </div>
                    <div className="text-right text-lg font-black text-emerald-700">{tier.price}</div>
                  </div>
                  <ul className="mt-5 space-y-2 text-sm text-slate-700">
                    {tier.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showPayouts && (
        <section className="bg-slate-50 py-14">
          <div className="container">
            <div className="grid gap-4 md:grid-cols-3">
              {PAYOUT_OPTIONS.map((option) => (
                <div key={option.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-slate-950">{option.name}</h3>
                  <div className="mt-3 text-3xl font-black text-emerald-700">{option.fee}</div>
                  <p className="mt-3 text-sm text-slate-600">{option.availability}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
