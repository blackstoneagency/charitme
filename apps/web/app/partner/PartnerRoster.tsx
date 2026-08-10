import 'server-only';
import { getPublicSponsors } from '../../lib/sponsors-server';
import { displayableSponsors, sponsorLogoUrl, sponsorHref } from '../../lib/sponsors-core';

/**
 * The organisations actually partnered with CharitMe, read from `sponsors`.
 *
 * ⚠️ Before this, `sponsors` had an admin CRUD and a public API endpoint with
 * **no public consumer**: an administrator could add a partner and it appeared
 * nowhere on the site. The reference artwork shows a partner-logo strip on this
 * page, and the table for it already existed — so this connects what was there
 * rather than inventing a second partners list.
 *
 * Renders **nothing at all** when there are no partners yet. An empty logo strip
 * under a heading reading "Our partners" is worse than no section: it states
 * that the platform has none.
 */
export default async function PartnerRoster() {
  const sponsors = await getPublicSponsors();

  // A read failure is not "no partners". Saying nothing is the honest fallback
  // here — this is a supporting section, and an error box would be louder than
  // the fact deserves.
  if (sponsors === null) return null;

  const shown = displayableSponsors(sponsors);
  if (shown.length === 0) return null;

  return (
    <section id="partners" aria-labelledby="partner-roster-heading" style={{ padding: '8px 0 4px', minWidth: 0 }}>
      <h2 id="partner-roster-heading" style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em' }}>
        Organisations we work with
      </h2>
      <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--t2)', maxWidth: 620 }}>
        {shown.length === 1
          ? 'One organisation currently partners with CharitMe.'
          : `${shown.length} organisations currently partner with CharitMe.`}
      </p>

      <ul className="partner-roster" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((sponsor) => {
          const logo = sponsorLogoUrl(sponsor);
          const href = sponsorHref(sponsor);
          const inner = (
            <>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  data-image-entity={`sponsor:${sponsor.id}`}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 40, height: 40, objectFit: 'contain', flex: '0 0 auto' }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{ width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'var(--s3)', color: 'var(--t2)', fontSize: 15, fontWeight: 800 }}
                >
                  {sponsor.name.trim().slice(0, 1).toUpperCase() || '?'}
                </span>
              )}
              {/* The NAME is the accessible label, always present. The logo is
                  decorative (alt="") because a logo alt of the same name would
                  read the partner out twice to a screen reader. */}
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', minWidth: 0, overflowWrap: 'anywhere' }}>
                {sponsor.name}
              </span>
            </>
          );

          return (
            <li key={sponsor.id} className="partner-roster-item">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="partner-roster-link"
                >
                  {inner}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="partner-roster-link">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
