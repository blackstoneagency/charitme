'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CampaignImage from '../../components/CampaignImage';

/**
 * The icon badge each card carries in the reference. One glyph per cause,
 * cycled by rank so neighbouring cards never repeat, and inline SVG so twenty
 * badges cost no extra requests.
 *
 * `aria-hidden` throughout: the card's own heading already names the cause, so
 * announcing a decorative glyph beside it would just repeat the name.
 */
const CARD_ICONS = [
  <path key="0" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  <path key="1" d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10ZM3 11h4l2-3 3 6 2-3h5" />,
  <path key="2" d="M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />,
  <path key="3" d="M12 3a6 6 0 0 1 6 6c0 4-6 12-6 12S6 13 6 9a6 6 0 0 1 6-6ZM12 7v4M10 9h4" />,
  <path key="4" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9" />,
  <path key="5" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
];

export interface BrowseCause {
  slug: string;
  label: string;
  blurb: string;
  photo: string;
  /** Undefined when the count could not be measured — never rendered as 0. */
  campaigns?: number;
  raisedCents?: number;
  /** Order in the source list, used for the "featured" sort. */
  rank: number;
}

type SortKey = 'popular' | 'campaigns' | 'raised' | 'az';
type View = 'grid' | 'list';

/**
 * The "Browse by cause" controls: filter pills, sort, and the grid/list toggle.
 *
 * Client-side because all three are pure view state over a list the server has
 * already sent — twenty causes, fully known at render. Round-tripping to the
 * server for a sort would add a network wait to a control that should feel
 * instant, and would make the URL the source of truth for something nobody
 * links to.
 *
 * ⚠️ Sorts that depend on an UNMEASURED figure put those causes last rather
 * than treating a missing count as zero. A cause whose count failed to load is
 * not the least popular cause; it is a cause we could not count, and ranking it
 * as though it were empty would state something false.
 */
export default function CausesBrowser({ causes }: { causes: BrowseCause[] }) {
  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('popular');
  const [view, setView] = useState<View>('grid');

  // The pill row: "All causes" plus the featured ones, which is what the
  // reference shows. Derived from the same list the grid renders, so a pill can
  // never point at a cause that is not there.
  const pills = useMemo(
    () => [{ slug: 'all', label: 'All causes' }, ...causes.slice(0, 7).map((c) => ({ slug: c.slug, label: c.label }))],
    [causes],
  );

  const shown = useMemo(() => {
    const list = filter === 'all' ? [...causes] : causes.filter((c) => c.slug === filter);
    const missingLast = (a?: number, b?: number) => {
      if (a === undefined && b === undefined) return 0;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return b - a;
    };
    if (sort === 'campaigns') return list.sort((a, b) => missingLast(a.campaigns, b.campaigns));
    if (sort === 'raised') return list.sort((a, b) => missingLast(a.raisedCents, b.raisedCents));
    if (sort === 'az') return list.sort((a, b) => a.label.localeCompare(b.label));
    return list.sort((a, b) => a.rank - b.rank);
  }, [causes, filter, sort]);

  const money = (cents: number) =>
    cents >= 1_000_000_00
      ? `$${(cents / 100_000_000).toFixed(1)}M`
      : `$${Math.round(cents / 100).toLocaleString('en-US')}`;

  return (
    <>
      <div className="cx-controls">
        <div className="cx-pills" role="group" aria-label="Filter by cause">
          {pills.map((p) => (
            <button
              key={p.slug}
              type="button"
              aria-pressed={filter === p.slug}
              onClick={() => setFilter(p.slug)}
              className={`cx-pill${filter === p.slug ? ' is-on' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="cx-tools">
          <label className="cx-sort">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="popular">Most popular</option>
              <option value="campaigns">Most campaigns</option>
              <option value="raised">Most raised</option>
              <option value="az">A–Z</option>
            </select>
          </label>
          <div className="cx-view" role="group" aria-label="View as">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`cx-view-btn${view === v ? ' is-on' : ''}`}
              >
                {v === 'grid' ? 'Grid' : 'List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Announced, not just visible: changing a filter and having the page
          silently reflow is the classic screen-reader dead end. */}
      <p role="status" aria-live="polite" className="cx-count">
        Showing {shown.length} of {causes.length} causes
      </p>

      <ul className={`cx-grid${view === 'list' ? ' is-list' : ''}`}>
        {shown.map((c) => (
          <li key={c.slug}>
            <Link href={`/causes/${c.slug}`} className="cx-card">
              <span className="cx-card-media">
                <span className={`cx-card-ic cx-card-ic--${c.rank % 6}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {CARD_ICONS[c.rank % 6]}
                  </svg>
                </span>
                <CampaignImage
                  src={c.photo}
                  category={null}
                  campaignKey={c.slug}
                  alt=""
                  width={360}
                  height={230}
                />
              </span>
              <span className="cx-card-body">
                <strong>{c.label}</strong>
                <span className="cx-card-blurb">{c.blurb}</span>
                <span className="cx-card-meta">
                  {/* Rendered only when actually measured. A cause with an
                      unreadable count shows neither figure rather than "0". */}
                  {c.campaigns !== undefined && (
                    <span className="cx-card-count">
                      {c.campaigns.toLocaleString()} {c.campaigns === 1 ? 'campaign' : 'campaigns'}
                    </span>
                  )}
                  {c.raisedCents !== undefined && (
                    <span className="cx-card-raised">{money(c.raisedCents)} raised</span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="cx-empty">No causes match that filter. Choose “All causes” to see every one.</p>
      )}
    </>
  );
}
