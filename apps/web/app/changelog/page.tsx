import Link from 'next/link';
import type { Metadata } from 'next';
import { CHANGELOG, CHANGE_KIND_LABEL, type ChangeKind } from '../../lib/changelog';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'What is new in CharitMe — new features, improvements and fixes, by date.',
  alternates: { canonical: 'https://www.charitme.com/changelog' },
};

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// The *-text tokens, not the brand fills. These render as 11px/800 label text
// (and its border), and the fills do not clear AA at that size on the light
// surface: --green measured 3.06:1 and --blue 3.87:1 against 4.5:1. The
// accent-as-text pairs exist for exactly this, and also clear the 3:1 that the
// border needs as a non-text graphic.
const KIND_COLOR: Record<ChangeKind, string> = {
  added: 'var(--green-text)',
  improved: 'var(--blue-text)',
  fixed: 'var(--t3)',
};

// Design #166. Entries live in lib/changelog.ts; see that file for the two rules
// this page depends on — only merged work is listed, and entries are anchored to
// dates rather than to a version number this repo does not actually produce.
export default function ChangelogPage() {
  return (
    <div className="pub-page simple-public">
      <section>
        <div className="pub-breadcrumb">
          <Link href="/">Home</Link> <span>&gt;</span> <b>Changelog</b>
        </div>
        <h1>Changelog</h1>
        <p className="pub-lede">
          What we have shipped, most recent first. Every entry here is live on CharitMe today.
        </p>

        <ol style={{ listStyle: 'none', margin: '32px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 32 }}>
          {CHANGELOG.map((release) => (
            <li key={release.date}>
              <article>
                <header style={{ marginBottom: 12 }}>
                  <time
                    dateTime={release.date}
                    style={{ fontSize: 13, color: 'var(--t3)', fontWeight: 600 }}
                  >
                    {dateFmt.format(new Date(`${release.date}T00:00:00Z`))}
                  </time>
                  <h2 style={{ margin: '4px 0 0', fontSize: 20 }}>{release.title}</h2>
                </header>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
                  {release.changes.map((change, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          flex: '0 0 auto',
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '.04em',
                          color: KIND_COLOR[change.kind],
                          border: `1px solid ${KIND_COLOR[change.kind]}`,
                          borderRadius: 999,
                          padding: '2px 8px',
                          marginTop: 2,
                        }}
                      >
                        {CHANGE_KIND_LABEL[change.kind]}
                      </span>
                      <span style={{ fontSize: 15, lineHeight: 1.5 }}>{change.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
