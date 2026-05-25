import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlatformModule, PLATFORM_MODULES } from '../../../lib/feature-catalog';

export function generateStaticParams() {
  return PLATFORM_MODULES.map((module) => ({ slug: module.slug }));
}

type FeaturePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: FeaturePageProps) {
  const { slug } = await params;
  const platformModule = getPlatformModule(slug);
  return {
    title: platformModule ? `${platformModule.title} | GiveRise Features` : 'GiveRise Features',
    description: platformModule?.summary,
  };
}

export default async function FeatureDetailPage({ params }: FeaturePageProps) {
  const { slug } = await params;
  const platformModule = getPlatformModule(slug);
  if (!platformModule) notFound();

  return (
    <div className="bg-white">
      <section className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="container py-14">
          <Link href="/features" className="text-sm font-black text-emerald-300">All features</Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">{platformModule.eyebrow}</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight md:text-6xl">{platformModule.title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{platformModule.summary}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Audience</div>
              <p className="mt-3 text-xl font-black">{platformModule.audience}</p>
              <Link href="/create" className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950">
                {platformModule.primaryCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container grid gap-10 py-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="text-3xl font-black text-slate-950">How It Works</h2>
          <div className="mt-5 space-y-3">
            {platformModule.operatingModel.map((item, index) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Step {index + 1}</div>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-2xl font-black text-slate-950">Data Model</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {platformModule.databaseTables.map((table) => (
              <span key={table} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                {table}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-black text-slate-950">Feature Coverage</h2>
          <div className="mt-5 grid gap-3">
            {platformModule.features.map((feature) => (
              <div key={`${feature.competitor}-${feature.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{feature.competitor}</span>
                  <h3 className="text-lg font-black text-slate-950">{feature.name}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
