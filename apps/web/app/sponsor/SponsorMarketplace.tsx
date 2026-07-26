'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoneyShort } from '@shared/currencies';
import { Badge, Spinner, EmptyState, ProgressBar } from '../../components/ui';
import { fundingProgress } from '../../lib/sponsorships-core';
import type { OpportunityWithOrganizer } from '../../lib/sponsorships';

function OpportunityCard({ o }: { o: OpportunityWithOrganizer }) {
  const progress = fundingProgress(o);
  return (
    <Link
      href={`/sponsor/${o.id}`}
      style={{
        display: 'block',
        border: '1px solid var(--b2)',
        borderRadius: 'var(--rl)',
        padding: '18px',
        background: 'var(--s1)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Badge color="blue">{o.category}</Badge>
        {o.min_amount_cents > 0 && (
          <Badge color="gray">From {formatMoneyShort(o.min_amount_cents, o.currency)}</Badge>
        )}
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{o.title}</h2>
      <p style={{ color: 'var(--t3)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        {o.description.length > 150 ? `${o.description.slice(0, 150)}…` : o.description}
      </p>
      {progress !== null && (
        <div style={{ marginTop: 12 }}>
          <ProgressBar value={o.raised_amount_cents} max={o.target_amount_cents ?? 1} />
          <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 6 }}>
            {formatMoneyShort(o.raised_amount_cents, o.currency)} of{' '}
            {formatMoneyShort(o.target_amount_cents ?? 0, o.currency)} committed ({progress}%)
          </div>
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 13, color: 'var(--t4)' }}>
        {o.campaign_title ? `For: ${o.campaign_title}` : o.organizer_name ? `Posted by ${o.organizer_name}` : null}
      </div>
    </Link>
  );
}

export default function SponsorMarketplace({
  initialOpportunities,
  categories,
}: {
  initialOpportunities: OpportunityWithOrganizer[];
  categories: string[];
}) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search.trim()) params.set('search', search.trim());
    try {
      const res = await fetch(`/api/sponsorships/opportunities?${params.toString()}`);
      const json = await res.json();
      setOpportunities(json.opportunities ?? []);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    // Skip the fetch on mount: the server already rendered `initialOpportunities`
    // for the unfiltered view, so refetching it immediately re-requests identical
    // data AND swaps the SSR'd grid for the centred spinner mid-flight — a large
    // layout shift (measured CLS 0.96 on this page) on every visit. Only fetch
    // once a filter actually changes. Mirrors the guard in VolunteerClient.
    if (!category && !search.trim() && opportunities === initialOpportunities) return;
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search]);

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 'var(--r)',
    border: '1px solid var(--b2)',
    background: 'var(--s1)',
    color: 'var(--t1)',
    fontSize: 14,
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
        <input
          type="search"
          placeholder="Search opportunities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search sponsorship opportunities"
          style={{ ...inputStyle, flex: '1 1 240px' }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" style={inputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Link
          href="/sponsor/manage"
          style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600, color: 'var(--green-dark)', textDecoration: 'none' }}
        >
          Post an opportunity →
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner />
        </div>
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="No sponsorship opportunities match your filters"
          body="Try clearing the filters, or check back soon — new opportunities are posted regularly."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
          {opportunities.map((o) => (
            <OpportunityCard key={o.id} o={o} />
          ))}
        </div>
      )}
    </div>
  );
}
