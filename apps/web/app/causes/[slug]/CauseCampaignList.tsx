'use client';

import { useState } from 'react';
import { CampaignCard, CampaignGrid, type CampaignCardData } from '../../../components/CampaignCard';

// ─────────────────────────────────────────────────────────────────────────────
// Cause pages show SIX campaigns, then a "See more campaigns" button that loads
// the next six.
//
// The first page is server-rendered, so the cards are in the HTML: the page is
// indexable and the initial paint needs no JavaScript. Only the additional pages
// are fetched, which is why this component takes `initial` rather than loading
// everything itself.
//
// The button used to be a LINK to /campaigns. That lost the cause: a cause spans
// several categories and /campaigns filters on one, so following it showed a
// different set of campaigns than the page the visitor was reading. Loading in
// place keeps the cause intact.
// ─────────────────────────────────────────────────────────────────────────────

export const CAUSE_PAGE_SIZE = 6;

export default function CauseCampaignList({
  initial,
  categories,
  hasMore: initialHasMore,
  seeMoreLabel,
}: {
  initial: CampaignCardData[];
  categories: readonly string[];
  hasMore: boolean;
  seeMoreLabel: string;
}) {
  const [campaigns, setCampaigns] = useState<CampaignCardData[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setLoading(true);
    setFailed(false);
    try {
      // `page` is derived from what is already on screen rather than counted in
      // state, so a failed attempt retries the SAME page instead of skipping it.
      const page = Math.floor(campaigns.length / CAUSE_PAGE_SIZE) + 1;
      const params = new URLSearchParams({
        category: categories.join(','),
        page: String(page),
        limit: String(CAUSE_PAGE_SIZE),
        sort: 'raised',
      });
      const res = await fetch(`/api/campaigns?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { campaigns?: CampaignCardData[]; total?: number };
      const next = body.campaigns ?? [];

      // De-duplicated by id: campaigns are ordered by `raised_amount`, which a
      // donation can change between two requests, and a row that moves across
      // the page boundary would otherwise appear twice with the same React key.
      setCampaigns((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...next.filter((c) => !seen.has(c.id))];
      });

      // A short page is the end of the list. Using the reported total instead
      // would trust a number this component cannot verify.
      setHasMore(next.length === CAUSE_PAGE_SIZE);
    } catch {
      // The button stays, so the visitor can retry. Silently hiding it would
      // claim there is nothing more to see, which is the one thing we do not know.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <CampaignGrid>
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} variant="feature" />
        ))}
      </CampaignGrid>

      {failed && (
        <p role="status" className="cl-more-error">
          Those did not load. Please try again.
        </p>
      )}

      {hasMore && (
        <div className="cl-more-wrap">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="cl-more-btn"
            // Names the growing list for screen readers, so activating the
            // button announces what changed rather than nothing at all.
            aria-controls="cause-campaign-grid"
          >
            {loading ? 'Loading…' : seeMoreLabel}
          </button>
        </div>
      )}
    </>
  );
}
