'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CampaignImage from '../../components/CampaignImage';

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
