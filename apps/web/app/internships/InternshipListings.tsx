import 'server-only';
import Link from 'next/link';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '../../lib/query-timeout';
import { OPPORTUNITY_PUBLIC_COLUMNS } from '../../lib/volunteers';
import { suppressDemoTrustAll } from '../../lib/demo-trust';
import {
  INTERNSHIP_CATEGORIES,
  placesRemaining,
  describeLocation,
} from '../../lib/internships-core';

/**
 * Live internship listings, read from `volunteer_opportunities`.
 *
 * `/internships` was a fully static page — four paragraphs describing internships
 * that did not exist as records anywhere, with a button leading nowhere real.
 * The listings below are the same rows the volunteer surface serves, filtered to
 * the internship categories, so anything posted through the existing volunteer
 * admin appears here with no extra step and no second schema.
 */

type Row = {
  id: string;
  slug: string;
  title: string;
  org_name: string;
  summary: string | null;
  category: string | null;
  location: string | null;
  is_remote: boolean;
  time_commitment: string | null;
  slots: number | null;
  slots_filled: number | null;
  status: string;
  verified: boolean;
};

/** `null` means the read FAILED — never conflated with "no internships open". */
async function loadInternships(limit = 24): Promise<Row[] | null> {
  try {
  // See the note in lib/sponsors-server.ts: supabaseAdmin throws on property
  // access when the env is missing, which `if (error)` cannot catch.
  const { data, error } = await boundedQuery(() =>
    supabaseAdmin
      .from('volunteer_opportunities')
      .select(OPPORTUNITY_PUBLIC_COLUMNS)
      .is('deleted_at', null)
      .in('status', ['open', 'upcoming'])
      // Filtered in the DATABASE rather than fetched-then-filtered: pulling 24
      // volunteer rows and keeping the internships would usually keep none.
      .in('category', INTERNSHIP_CATEGORIES as unknown as string[])
      .order('verified', { ascending: false })
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(limit),
  );
  if (error) {
    console.warn('[internships] read failed', { code: error.code });
    return null;
  }
  // Demo rows must never render a fabricated "Verified" badge.
  return suppressDemoTrustAll((data ?? []) as unknown as Row[]) as unknown as Row[];
  } catch {
    return null;
  }
}

export default async function InternshipListings() {
  const rows = await loadInternships();

  return (
    <section id="open-internships" aria-labelledby="open-internships-heading" style={{ minWidth: 0 }}>
      <h2 id="open-internships-heading" style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em' }}>
        Open internships
      </h2>

      {rows === null ? (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--red-text)' }}>
          We could not load internships just now. That is a problem on our side,
          not an empty list — please try again shortly.
        </p>
      ) : rows.length === 0 ? (
        // The wording here is kept from the previous hand-written version of this
        // page, which had already made the right call: say nothing is open rather
        // than invent plausible openings and waste applicants' time. The only
        // change is that it is now reached by MEASURING the table instead of
        // being hardcoded, so real postings appear the moment they exist.
        <div style={{ padding: 26, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', maxWidth: 680, minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 750, color: 'var(--t1)', margin: 0 }}>
            No internships are currently open
          </h3>
          <p style={{ fontSize: 14, color: 'var(--t3)', lineHeight: 1.6, marginTop: 8 }}>
            We would rather say so than list positions we are not actively filling. Write to us
            anyway — describe something you have built and why this problem interests you. Those
            messages get read, and they have led to offers before a posting existed.
          </p>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            <Link href="/contact" style={actionLinkStyle}>Get in touch →</Link>
          </p>
          <p style={{ marginTop: 12, fontSize: 14, color: 'var(--t3)' }}>
            In the meantime, <Link href="/volunteer" style={linkStyle}>volunteer opportunities</Link> often
            lead to the same experience, and <Link href="/careers" style={linkStyle}>open roles</Link> are
            listed separately.
          </p>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--t2)', maxWidth: 620 }}>
            {rows.length === 1 ? 'One internship is' : `${rows.length} internships are`} currently
            accepting applications.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            {rows.map((row) => {
              const places = placesRemaining(row);
              return (
                <li key={row.id} style={cardStyle}>
                  <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: 'var(--t1)', minWidth: 0 }}>
                      <Link href={`/volunteer/${row.slug}`} style={{ color: 'inherit' }}>{row.title}</Link>
                    </h3>
                    {row.status === 'upcoming' && (
                      <span style={badgeStyle}>Opens soon</span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: 13, fontWeight: 650, color: 'var(--t2)' }}>{row.org_name}</p>

                  {row.summary && (
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--t2)', lineHeight: 1.55 }}>{row.summary}</p>
                  )}

                  <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4, fontSize: 13, color: 'var(--t3)' }}>
                    <div style={{ display: 'flex', minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
                      <dt style={{ fontWeight: 700 }}>Where:</dt>
                      <dd style={{ margin: 0 }}>{describeLocation(row)}</dd>
                    </div>
                    {row.time_commitment && (
                      <div style={{ display: 'flex', minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
                        <dt style={{ fontWeight: 700 }}>Commitment:</dt>
                        <dd style={{ margin: 0 }}>{row.time_commitment}</dd>
                      </div>
                    )}
                    {/* Only shown when a cap was actually published — `null`
                        means unstated, which is not "0 places left". */}
                    {places !== null && (
                      <div style={{ display: 'flex', minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
                        <dt style={{ fontWeight: 700 }}>Places left:</dt>
                        <dd style={{ margin: 0 }}>{places === 0 ? 'Full' : places}</dd>
                      </div>
                    )}
                  </dl>

                  <Link href={`/volunteer/${row.slug}`} className="kf-outline" style={{ minHeight: 44, justifyContent: 'center', textDecoration: 'none' }}>
                    View and apply
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

const cardStyle = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 9, alignContent: 'start',
  padding: 16, border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
  background: 'var(--s1)', minWidth: 0,
} as const;
const badgeStyle = {
  fontSize: 11, fontWeight: 750, padding: '3px 9px', borderRadius: 999,
  background: 'var(--tint-amber)', color: 'var(--orange-text)',
} as const;
const linkStyle = { color: 'var(--brand-text)', fontWeight: 650 } as const;
const actionLinkStyle = {
  ...linkStyle,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
} as const;
