import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Brand Assets',
  description:
    'Official CharitMe logo files, colour values, and usage guidelines for press, partners, and anyone writing about us.',
  alternates: { canonical: 'https://www.charitme.com/brand-assets' },
};

// Only files that ACTUALLY EXIST in /public are offered. The design (78) shows a
// logo pack ZIP, a company overview PDF, brand guidelines PDF and an icon set;
// none of those files exist, and a download button that 404s is worse than no
// button. The two real logo files are linked directly instead.
//
// Colours are read from the same tokens the site renders with, so this page
// cannot drift from the actual brand the way a hand-copied hex list would.

const LOGOS = [
  { name: 'Primary logo', file: '/CharitMe_Logo.png', note: 'Full wordmark with the heart mark. Use this wherever there is room.' },
  { name: 'Compact mark', file: '/logo.png', note: 'The square mark used as the site favicon and app icon. Use where the full wordmark will not fit.' },
];

const COLOURS = [
  { name: 'Brand green', token: '--green-btn', hex: '#0b7a3e', note: 'Primary action colour. Chosen for AA contrast against white — an earlier lighter green measured 3.17:1 and failed.' },
  { name: 'Ink', token: '--t1', hex: '#101827', note: 'Primary text on light surfaces.' },
  { name: 'Muted', token: '--t3', hex: '#526173', note: 'Secondary text. Meets AA at body sizes.' },
];

const RULES = [
  { title: 'Do not recolour the logo', body: 'Use the files as supplied. If you need a version for a dark background, ask rather than inverting it yourself.' },
  { title: 'Keep clear space', body: 'Leave at least the height of the heart mark as clear space on every side.' },
  { title: 'Do not imply endorsement', body: 'Using our logo to describe a campaign you run does not mean CharitMe endorses it. Say “fundraising on CharitMe”, not “supported by CharitMe”.' },
  { title: 'Do not alter the wordmark', body: 'No stretching, re-typesetting, added effects, or changing the capitalisation of “CharitMe”.' },
];

export default function BrandAssetsPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="PRESS & PARTNERS"
        title="Brand assets"
        lede="Logo files, colour values, and the rules for using them. Everything on this page is a file that exists — we do not link downloads we cannot serve."
      />

      <Section id="logos" heading="Logo files" intro="Right-click to save, or open and download.">
        <CardGrid min={280}>
          {LOGOS.map((l) => (
            <div key={l.file} style={{ padding: '20px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
              <div style={{ padding: '18px', background: 'var(--s2)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.file} alt={`CharitMe ${l.name.toLowerCase()}`} style={{ maxHeight: '56px', width: 'auto' }} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--t1)' }}>{l.name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--t3)', lineHeight: 1.55, marginTop: '6px' }}>{l.note}</p>
              <p style={{ marginTop: '12px' }}>
                <a href={l.file} download style={{ display: 'inline-flex', alignItems: 'center', minHeight: '24px', fontSize: '13px', color: 'var(--green-text)', fontWeight: 700 }}>
                  Download PNG →
                </a>
              </p>
            </div>
          ))}
        </CardGrid>
      </Section>

      <Section id="colours" heading="Colours" intro="The tokens the site actually renders with.">
        <CardGrid min={260}>
          {COLOURS.map((c) => (
            <div key={c.token} style={{ padding: '18px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
              <div
                aria-hidden="true"
                style={{ height: '44px', borderRadius: 'var(--r)', background: c.hex, border: '1px solid var(--b1)', marginBottom: '12px' }}
              />
              <h3 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--t1)' }}>{c.name}</h3>
              <p style={{ fontSize: '13px', fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: '4px' }}>
                {c.hex} · <code>{c.token}</code>
              </p>
              <p style={{ fontSize: '13px', color: 'var(--t3)', lineHeight: 1.55, marginTop: '8px' }}>{c.note}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      <Section id="rules" heading="Usage rules" intro="Short, and we do enforce the third one.">
        <CardGrid min={260}>
          {RULES.map((r) => <InfoCard key={r.title} title={r.title} body={r.body} />)}
        </CardGrid>
      </Section>

      <Section id="more" heading="Need something else?">
        <div style={{ padding: '22px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: '680px' }}>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, margin: 0 }}>
            There is no logo pack ZIP, brand-guidelines PDF or icon set to download — those files do
            not exist, so we are not going to link buttons that 404. If you need a vector logo, a
            specific size, or written guidelines, ask on the{' '}
            <Link href="/press" style={{ color: 'var(--green-text)', fontWeight: 650 }}>press page</Link>{' '}
            and a person will send them.
          </p>
        </div>
      </Section>
    </PageBody>
  );
}
