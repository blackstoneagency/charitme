import Link from 'next/link';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';

// Peer-to-peer / team fundraising — supporters who run their own page toward a
// parent campaign's goal. The `peer_fundraisers` table has held seeded rows and a
// full schema (FKs to campaigns and profiles, RLS, a parent-campaign index) since
// before this component existed, and `lib/feature-catalog.ts` advertised it as a
// shipped, database-backed capability — but nothing in app/, lib/ or components/
// ever issued a `.from('peer_fundraisers')`. `npm run audit:orphan-tables` is what
// surfaced it: 240 rows, zero readers.

export interface TeamFundraiser {
  id: string;
  /** Used to build the supporter's shareable page URL. */
  slug: string;
  title: string;
  goalCents: number;
  raisedCents: number;
  /** Null when the supporter's account-wide Profile Visibility is off. */
  name: string | null;
  avatarUrl: string | null;
  completed: boolean;
  /** Used only to tell the viewer they are already on this team. */
  fundraiserId: string;
}

export default function TeamFundraisers({
  fundraisers,
  campaignSlug,
  currency = DEFAULT_CURRENCY,
  action,
}: {
  fundraisers: TeamFundraiser[];
  /** Parent campaign slug — the supporter page lives at
   *  /campaigns/[slug]/team/[peerSlug], so the roster cannot link without it. */
  campaignSlug: string;
  currency?: string;
  /** The join control. Rendered even with an empty team — that is exactly when
   *  the first supporter needs it, and returning null here made the feature
   *  unreachable until someone had already joined by other means. */
  action?: React.ReactNode;
}) {
  if (fundraisers.length === 0 && !action) return null;

  const teamRaised = fundraisers.reduce((sum, f) => sum + f.raisedCents, 0);

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto 40px', padding: '0 24px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: 'var(--t1)' }}>
        Fundraising team
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: '0 0 16px' }}>
        {fundraisers.length === 0
          ? 'Be the first to raise money alongside this campaign.'
          : fundraisers.length === 1
            ? '1 supporter is raising money toward this goal'
            : `${fundraisers.length} supporters are raising money toward this goal`}
        {teamRaised > 0 && ` — ${formatMoneyShort(teamRaised, currency)} together`}
      </p>

      {fundraisers.length > 0 && (
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
          gap: 14,
        }}
      >
        {fundraisers.map((f) => {
          const pct = f.goalCents > 0 ? Math.min(100, Math.round((f.raisedCents / f.goalCents) * 100)) : 0;
          // The supporter's display name is gated on their profile visibility, but
          // the page title is content they authored for a public fundraising page,
          // so it always shows. Falling back to the title alone keeps a private
          // supporter countable without naming them.
          const heading = f.name ?? f.title;
          return (
            <li
              key={f.id}
              style={{
                border: '1px solid var(--b1)',
                borderRadius: 12,
                padding: 16,
                background: 'var(--s1)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                // min-width:auto — a grid child defaults to min-content and a long
                // supporter name would otherwise push the card past its column.
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {f.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    style={{ borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--s3)',
                      color: 'var(--t2)',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {heading.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  {/* The card links to the supporter's own page. Without this the
                      roster listed people whose pages existed and could not be
                      reached from anywhere in the product. */}
                  <Link
                    href={`/campaigns/${campaignSlug}/team/${f.slug}`}
                    style={{
                      display: 'block',
                      fontSize: 14.5,
                      fontWeight: 700,
                      color: 'var(--t1)',
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {heading}
                  </Link>
                  {f.completed && (
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>Goal reached 🎉</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13.5, color: 'var(--t2)', marginBottom: 6 }}>
                  <b style={{ color: 'var(--t1)' }}>{formatMoneyShort(f.raisedCents, currency)}</b>
                  {f.goalCents > 0 && ` of ${formatMoneyShort(f.goalCents, currency)}`}
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${heading}: ${pct}% of goal`}
                  style={{ height: 6, borderRadius: 999, background: 'var(--s3)', overflow: 'hidden' }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${pct}%`,
                      background: 'var(--green)',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      )}
      {action}
    </section>
  );
}
