import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import CampaignImage from './CampaignImage';

/**
 * The photo hero and measured stats strip shared by the browse-index pages
 * (`/causes`, `/campaigns`).
 *
 * ⚠️ Extracted rather than copied. This repo's recurring failure is a lookalike
 * that drifts — three copies of the category list, five of the public-route
 * list, ten implementations of "days left". A second hero would drift in the
 * two places it most matters: the scrim (which is what guarantees the text is
 * readable over an arbitrary photo) and the em-dash rule for an unmeasured
 * figure.
 *
 * The hero commits to a DARK treatment in both themes on purpose: it is white
 * text over a photograph, and the scrim guarantees the contrast rather than the
 * theme doing it. The stats strip below it does the opposite and follows the
 * visitor's theme, because a literal white card renders as a white slab in dark
 * mode — the defect `theme-tokens.test.ts` exists to block.
 */

export interface Crumb {
  label: string;
  href?: string;
}

export function IndexHero({
  crumbs,
  title,
  lede,
  actions,
  card,
  photo,
  photoCategory,
  photoKey,
  heart = false,
}: {
  crumbs: Crumb[];
  title: string;
  lede: string;
  actions?: ReactNode;
  card?: { title: string; body: string };
  photo: string;
  photoCategory: string | null;
  photoKey: string;
  /** Renders the reference's heart glyph beside the title. Decorative. */
  heart?: boolean;
}) {
  return (
    <section className="cx-hero" aria-labelledby="cx-hero-title">
      {/* Decorative: the H1 beside it already carries the meaning, so a screen
          reader announcing the photo would only repeat it. */}
      <div className="cx-hero-photo" aria-hidden="true">
        <CampaignImage
          src={photo}
          category={photoCategory}
          campaignKey={photoKey}
          alt=""
          width={900}
          height={620}
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div className="cx-hero-inner">
        <nav aria-label="Breadcrumb" className="cx-crumbs">
          <ol>
            {/* A Fragment, not a wrapper <li>. Nesting list items inside a list
                item renders each crumb twice and produces invalid <ol> markup. */}
            {crumbs.map((c, i) => (
              <Fragment key={c.label}>
                {i > 0 && <li aria-hidden="true">›</li>}
                {c.href
                  ? <li><Link href={c.href}>{c.label}</Link></li>
                  : <li aria-current="page">{c.label}</li>}
              </Fragment>
            ))}
          </ol>
        </nav>
        <div className="cx-hero-copy">
          <h1 id="cx-hero-title">
            {title}
            {heart && (
              <span className="cx-hero-heart" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
              </span>
            )}
          </h1>
          <p>{lede}</p>
          {actions && <div className="cx-hero-actions">{actions}</div>}
        </div>
        {card && (
          <aside className="cx-hero-card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </aside>
        )}
      </div>
    </section>
  );
}

export interface StatTile {
  /** Already formatted — an em-dash when the figure could not be measured. */
  value: string;
  label: string;
}

/** Four icons, in tile order. Inline SVG so the strip ships no extra requests. */
export const STRIP_ICONS = [
  <svg key="a" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>,
  <svg key="b" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  <svg key="c" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9" /></svg>,
  <svg key="d" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" /></svg>,
  // Fifth: /about-us runs a five-tile strip. STRIP_ICONS is indexed by tile
  // position, so a fifth tile without a fifth icon renders an empty span and
  // says nothing about it — the exact silent-fallback failure PublicIcon has.
  <svg key="e" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>,
];

export function StatStrip({ tiles, label }: { tiles: StatTile[]; label: string }) {
  return (
    <section className="cx-stats" aria-label={label}>
      {/* A <dl> may group its pairs with a <div>, but that div has to contain
          the <dt> and <dd> DIRECTLY. An extra wrapper around them had axe
          reporting definition-list AND dlitem, both serious. The icon lives
          inside the <dd> and is placed with CSS rather than adding a level. */}
      <dl>
        {tiles.map((tile, i) => (
          <div className="cx-stat" key={tile.label}>
            <dd>
              <span className={`cx-stat-ic cx-stat-ic--${i}`} aria-hidden="true">{STRIP_ICONS[i]}</span>
              <span className="cx-stat-value">{tile.value}</span>
            </dd>
            <dt>{tile.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** `—` for a figure we could not measure. Never "0": those are different facts. */
export function statValue(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString('en-US');
}

export function moneyValue(cents: number | null): string {
  if (cents === null) return '—';
  const d = Math.round(cents / 100);
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  return `$${d.toLocaleString('en-US')}`;
}
