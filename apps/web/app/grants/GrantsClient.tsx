'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Btn, Badge, EmptyState, Spinner } from '../../components/ui';
import type { Grant } from '../../lib/grants';

function formatAmountRange(min: number | null, max: number | null, currency: string): string {
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
      .format(Math.round(cents / 100));
  if (min == null && max == null) return 'Amount varies';
  if (min != null && max != null) return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  if (max != null) return `Up to ${fmt(max)}`;
  return `From ${fmt(min as number)}`;
}

function deadlineLabel(iso: string | null, rolling: boolean): { text: string; urgent: boolean } {
  if (rolling) return { text: 'Rolling deadline', urgent: false };
  if (!iso) return { text: 'No set deadline', urgent: false };
  const due = new Date(iso).getTime();
  const days = Math.ceil((due - Date.now()) / 86_400_000);
  if (days < 0) return { text: 'Closed', urgent: false };
  if (days === 0) return { text: 'Due today', urgent: true };
  if (days <= 14) return { text: `${days} day${days === 1 ? '' : 's'} left`, urgent: true };
  return { text: new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), urgent: false };
}

function GrantCard({ grant }: { grant: Grant }) {
  const dl = deadlineLabel(grant.deadline_at, grant.rolling_deadline);
  return (
    <Link href={`/grants/${grant.slug}`} style={{ display: 'block', height: '100%' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10, height: '100%',
        background: 'var(--bg)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
        padding: 18, transition: 'border-color .15s, transform .15s',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'capitalize' }}>
            {grant.funder_type} · {grant.funder_name}
          </span>
          {grant.verified && <Badge color="green">Verified</Badge>}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: 'var(--t1)', margin: 0 }}>{grant.title}</h2>
        {grant.summary && (
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {grant.summary}
          </p>
        )}
        {grant.focus_areas.length > 0 && (
          <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 6 }}>
            {grant.focus_areas.slice(0, 3).map((f) => <Badge key={f} color="blue">{f}</Badge>)}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--b1)' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>
            {formatAmountRange(grant.amount_min, grant.amount_max, grant.currency)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: dl.urgent ? 'var(--red-text)' : 'var(--t3)' }}>{dl.text}</span>
        </div>
      </div>
    </Link>
  );
}

export default function GrantsClient({
  initialGrants,
  categories,
}: {
  initialGrants: Grant[];
  categories: string[];
}) {
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string, cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (cat) params.set('category', cat);
      params.set('limit', '48');
      const res = await fetch(`/api/grants?${params.toString()}`);
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();
      setGrants(json.grants ?? []);
    } catch {
      setError('Could not load grants. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    // Skip the very first render (we already have initialGrants).
    if (query === '' && category === '' && grants === initialGrants) return;
    debounce.current = setTimeout(() => runSearch(query, category), 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search + filter controls */}
      <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search grants, funders, focus areas…"
            aria-label="Search grants"
            style={{
              width: '100%', padding: '12px 14px', border: '1px solid var(--b1)',
              borderRadius: 'var(--rl)', fontSize: 14, color: 'var(--t1)', background: 'var(--bg)', outline: 'none',
            }}
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          style={{
            padding: '12px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
            fontSize: 14, color: 'var(--t1)', background: 'var(--bg)', minWidth: 160,
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(query || category) && (
          <Btn variant="ghost" size="sm" onClick={() => { setQuery(''); setCategory(''); setGrants(initialGrants); }}>
            Clear
          </Btn>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ display: 'flex', minWidth: 0, justifyContent: 'center', padding: 60, color: 'var(--t3)' }}><Spinner /></div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Something went wrong" body={error}
          action={<Btn variant="secondary" onClick={() => runSearch(query, category)}>Retry</Btn>} />
      ) : grants.length === 0 ? (
        <EmptyState icon="🔍" title="No grants found"
          body="Try a different search term or clear the filters to see all open opportunities." />
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>
            {grants.length} open {grants.length === 1 ? 'opportunity' : 'opportunities'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(240px, 100%, 300px), 1fr))', gap: 16 }}>
            {grants.map((g) => <GrantCard key={g.id} grant={g} />)}
          </div>
        </>
      )}
    </div>
  );
}
