import type { ReactElement } from 'react';
import { headers } from 'next/headers';
import { safeJsonLd } from '../lib/json-ld';
import { buildAeoJsonLd, getPublishedAeoEntries, groupFaqsByTopic } from '../lib/aeo';

export default async function AeoContent({ route, title = 'Answers from CharitMe', visible = true }: { route: string; title?: string; visible?: boolean }): Promise<ReactElement | null> {
  const entries = await getPublishedAeoEntries(route);
  if (entries.length === 0) return null;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const faqEntries = entries.filter((entry) => entry.schema_type === 'FAQPage');
  const qaEntries = entries.filter((entry) => entry.schema_type === 'QAPage');
  const howToEntries = entries.filter((entry) => entry.schema_type === 'HowTo');
  if (faqEntries.length === 0 && qaEntries.length === 0 && howToEntries.length === 0) return null;
  const sections = groupFaqsByTopic(faqEntries);
  const jsonLd = buildAeoJsonLd(entries);

  if (!visible) return <>{jsonLd.map((schema, index) => <script key={index} nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />)}</>;

  return (
    <section className="border-t border-slate-100 py-16" aria-labelledby="published-aeo-answers">
      {jsonLd.map((schema, index) => <script key={index} nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />)}
      <div className="container">
        <div className="mx-auto max-w-3xl">
          <h2 id="published-aeo-answers" className="mb-8 text-2xl font-black text-slate-950">{title}</h2>
          <div className="space-y-10">
            {sections.map((section) => (
              <div key={section.topic}>
                <h3 className="mb-4 text-lg font-black text-slate-950">{section.topic}</h3>
                <div className="space-y-4">{section.items.map((entry) => <article key={entry.question} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h4 className="font-black text-slate-950">{entry.question}</h4><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{entry.answer}</p></article>)}</div>
              </div>
            ))}
            {qaEntries.map((entry) => <article key={entry.question} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-black text-slate-950">{entry.question}</h3><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{entry.answer}</p></article>)}
            {howToEntries.map((entry) => <article key={entry.question} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-black text-slate-950">{entry.question}</h3><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{entry.answer}</p></article>)}
          </div>
        </div>
      </div>
    </section>
  );
}
