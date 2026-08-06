import 'server-only';
import { getPublishedReports, reportDownloadUrl } from '../../lib/platform-reports-server';
import {
  groupByKind,
  formatBytes,
  isDownloadable,
  periodOf,
  REPORT_KIND_LABEL,
} from '../../lib/platform-reports-core';

/**
 * Downloadable platform reports.
 *
 * ⚠️ **Renders NOTHING until there is something to download.** The table is
 * created by `20260826000000_platform_reports.sql`, which the owner applies —
 * before that the reader answers `42P01` and this returns `null`. That is
 * deliberate: a "Reports" heading over an empty list states that the
 * organisation publishes none, which is a different and untrue claim.
 *
 * The moment the migration is applied and a report is published, this section
 * appears with no code change and no second deploy.
 */
export default async function PublishedReports() {
  const reports = await getPublishedReports();

  // A read failure is not "no reports". Saying nothing is the honest fallback
  // for a supporting section — an error box here would be louder than the fact.
  if (reports === null) return null;

  const groups = groupByKind(reports);
  if (groups.length === 0) return null;

  return (
    <section id="published-reports" aria-labelledby="published-reports-heading" style={{ minWidth: 0, marginBottom: 52 }}>
      <h2 id="published-reports-heading" style={{ margin: '0 0 6px', fontSize: 'var(--fs-h2)', fontWeight: 780, color: 'var(--t1)', letterSpacing: '-.01em' }}>
        Reports you can download
      </h2>
      <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--t2)', maxWidth: 640 }}>
        Published documents, as filed. Each one states the period it covers on its
        own cover — that wording is what is shown here.
      </p>

      {groups.map((group) => (
        <div key={group.kind} style={{ marginBottom: 24, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 750, color: 'var(--t2)' }}>
            {REPORT_KIND_LABEL[group.kind]}
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
            {group.reports.map((r) => {
              const href = isDownloadable(r) ? reportDownloadUrl(r.file_path) : null;
              const size = formatBytes(r.byte_size);
              const period = periodOf(r);
              return (
                <li key={r.id} style={card}>
                  <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 15, fontWeight: 750, color: 'var(--t1)', minWidth: 0, overflowWrap: 'anywhere' }}>{r.title}</strong>
                    {period && <span style={{ fontSize: 12.5, color: 'var(--t3)', fontWeight: 650 }}>{period}</span>}
                  </div>

                  {r.summary && (
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.55 }}>{r.summary}</p>
                  )}

                  {href ? (
                    <a
                      href={href}
                      // `download` so a click saves rather than navigating away
                      // from the page a reader is comparing documents on.
                      download
                      className="kf-outline"
                      style={{ minHeight: 44, justifyContent: 'center', textDecoration: 'none' }}
                    >
                      Download PDF{size ? ` · ${size}` : ''}
                    </a>
                  ) : (
                    // The database refuses this combination, but a reader must not
                    // depend on a constraint from a migration that may not have run
                    // everywhere. Text, never a button that 404s.
                    <span style={{ fontSize: 13, color: 'var(--t3)' }}>File not yet attached.</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

const card = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 9, alignContent: 'start',
  padding: 16, border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
  background: 'var(--s1)', minWidth: 0,
} as const;
