import Link from 'next/link';
import type { Metadata } from 'next';
import { GLOSSARY_TERMS, glossaryByLetter, glossaryLetters } from '../../lib/glossary';
import { PageBody, PageHero, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Glossary',
  description:
    'Key fundraising terms explained — platform fees, payouts, verification, trust scores, tax receipts, and how each one works on CharitMe.',
  alternates: { canonical: 'https://www.charitme.com/glossary' },
};

export default function GlossaryPage() {
  const groups = glossaryByLetter();
  const letters = glossaryLetters();

  return (
    <PageBody>
      <PageHero
        eyebrow="RESOURCES"
        title="Glossary"
        lede={`${GLOSSARY_TERMS.length} terms, defined as they actually work on CharitMe rather than in the abstract. Where a term has its own page, it links there.`}
      />

      {/* The letter index is DERIVED from the terms, so it can never advertise a
          letter that has nothing under it. */}
      <nav aria-label="Jump to letter" style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: '6px', marginBottom: '32px' }}>
        {letters.map((l) => (
          <a
            key={l}
            href={`#letter-${l}`}
            style={{
              minWidth: '32px',
              minHeight: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--r)',
              border: '1px solid var(--b1)',
              background: 'var(--s1)',
              color: 'var(--t1)',
              fontSize: '13px',
              fontWeight: 750,
              textDecoration: 'none',
            }}
          >
            {l}
          </a>
        ))}
      </nav>

      {groups.map(({ letter, terms }) => (
        <section key={letter} aria-labelledby={`letter-${letter}`} style={{ marginBottom: '36px' }}>
          <h2
            id={`letter-${letter}`}
            style={{ fontSize: '20px', fontWeight: 800, color: 'var(--green-text)', marginBottom: '14px', scrollMarginTop: '90px' }}
          >
            {letter}
          </h2>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '14px', margin: 0 }}>
            {terms.map((t) => (
              <div
                key={t.term}
                style={{ padding: '18px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}
              >
                {/* The term link is a STANDALONE control, not a link inside a
                    sentence, so the WCAG 2.5.8 inline exception does not cover it —
                    it measured 18px tall. Sized inline because this page's markup
                    carries no classes and a bare `dt > a` rule would reach every
                    definition list on the site. The "Read more" link below is left
                    as-is on purpose: it sits within a sentence, which IS exempt. */}
                <dt style={{ fontSize: '15px', fontWeight: 750, color: 'var(--t1)', marginBottom: '6px' }}>
                  {t.href ? (
                    <Link
                      href={t.href}
                      style={{
                        color: 'var(--t1)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 24,
                      }}
                    >
                      {t.term}
                    </Link>
                  ) : (
                    t.term
                  )}
                </dt>
                <dd style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.6, margin: 0 }}>
                  {t.definition}
                  {t.href && (
                    <>
                      {' '}
                      <Link href={t.href} style={{ color: 'var(--green-text)', fontWeight: 650 }}>
                        Read more
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <CtaBand
        heading="New to fundraising?"
        body="The guide walks through the six steps to a funded campaign, in the order you take them."
        primary={{ label: 'Fundraising guide', href: '/fundraising-guide' }}
        secondary={{ label: 'How it works', href: '/how-it-works' }}
      />
    </PageBody>
  );
}
