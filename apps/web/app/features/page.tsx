import Link from 'next/link';
import { getFeatureCoverage, PLATFORM_MODULES } from '../../lib/feature-catalog';

export const metadata = {
  title: 'KindFund Feature Platform',
  description: 'A production-ready AI-first fundraising platform covering modern fundraising, memberships, nonprofit CRM, events, creator commerce, and trust.',
};

export default function FeaturesPage() {
  const coverage = getFeatureCoverage();

  return (
    <div className="bg-white">
      <section className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="container grid gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">Competitive platform coverage</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight md:text-6xl">
              Every table-stakes fundraising feature, plus the AI trust layer competitors do not have.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              KindFund combines campaign fundraising, project launches, recurring memberships, nonprofit operations, creator commerce,
              events, auctions, analytics, and AI-powered trust into one production-ready platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950">
                Start free
              </Link>
              <Link href="/features/ai-trust-growth" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white">
                View AI moat
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
              <div className="text-3xl font-black">{coverage.moduleCount}</div>
              <div className="mt-1 text-sm font-bold text-slate-300">Product modules</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
              <div className="text-3xl font-black">{coverage.featureCount}</div>
              <div className="mt-1 text-sm font-bold text-slate-300">Mapped features</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 sm:col-span-1">
              <div className="text-3xl font-black">0%</div>
              <div className="mt-1 text-sm font-bold text-slate-300">Mandatory platform fee</div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PLATFORM_MODULES.map((module) => (
            <Link
              key={module.slug}
              href={`/features/${module.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{module.eyebrow}</p>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{module.status}</span>
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-950">{module.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{module.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {module.features.slice(0, 5).map((feature) => (
                  <span key={`${module.slug}-${feature.name}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {feature.name}
                  </span>
                ))}
              </div>
              <div className="mt-6 text-sm font-black text-emerald-700 group-hover:text-emerald-800">Open module</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-14">
        <div className="container">
          <h2 className="text-3xl font-black text-slate-950">Competitor Coverage</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {coverage.competitors.map((competitor) => (
              <div key={competitor.name} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-lg font-black text-slate-950">{competitor.name}</div>
                <div className="mt-1 text-sm font-bold text-slate-500">{competitor.count} required features mapped</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
