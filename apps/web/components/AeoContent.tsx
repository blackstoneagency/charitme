import type { ReactElement } from 'react';
import { safeJsonLd } from '../lib/json-ld';
import { getPublishedAeoEntries, groupFaqsByTopic } from '../lib/aeo';

export default async function AeoContent({ route, title = 'Answers from CharitMe' }: { route: string; title?: string }): Promise<ReactElement | null> {
  const entries = await getPublishedAeoEntries(route);
  if (entries.length === 0) return null;

  const faqEntries = entries.filter((entry) => entry.schema_type === 'FAQPage');
  const qaEntries = entries.filter((entry) => entry.schema_type === 'QAPage');
  const sections = groupFaqsByTopic(faqEntries);
  const jsonLd = [
    ...(faqEntries.length > 0 ? [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntries.map((entry) => ({
        '@type': 'Question', name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    }] : []),
    ...qaEntries.map((entry) => ({
      '@context': 'https://schema.org', '@type': 'QAPage',
      mainEntity: { '@type': 'Question', name: entry.question, acceptedAnswer: { '@type': 'Answer', text: entry.answer } },
    })),
  ];

  return (
    <section className="border-t border-slate-100 py-16" aria-labelledby="published-aeo-answers">
      {jsonLd.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />)}
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
          </div>
        </div>
      </div>
    </section>
  );
}
import type { ReactNode } from 'react';
