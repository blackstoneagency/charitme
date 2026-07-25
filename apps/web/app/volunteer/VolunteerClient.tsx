'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Btn, Badge, EmptyState, Spinner } from '../../components/ui';
import type { VolunteerOpportunity } from '../../lib/volunteers';

function whenLabel(starts: string | null, remote: boolean): string {
  if (remote && !starts) return 'Remote · flexible';
  if (!starts) return remote ? 'Remote' : 'Flexible timing';
  const d = new Date(starts);
  return (remote ? 'Remote · ' : '') + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function OppCard({ opp }: { opp: VolunteerOpportunity }) {
  const full = opp.slots != null && opp.slots_filled >= opp.slots;
  return (
    <Link href={`/volunteer/${opp.slug}`} style={{ display: 'block', height: '100%' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10, height: '100%',
        background: 'var(--bg)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>{opp.org_name}</span>
          {opp.verified && <Badge color="green">Verified</Badge>}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: 'var(--t1)', margin: 0 }}>{opp.title}</h2>
        {opp.summary && (
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{opp.summary}</p>
        )}
        {opp.skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {opp.skills.slice(0, 3).map((s) => <Badge key={s} color="blue">{s}</Badge>)}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--b1)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)' }}>{whenLabel(opp.starts_at, opp.is_remote)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: full ? 'var(--red)' : 'var(--green)' }}>
            {full ? 'Full' : opp.time_commitment || 'Open'}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function VolunteerClient({
  initialOpportunities,
  categories,
}: {
  initialOpportunities: VolunteerOpportunity[];
  categories: string[];
}) {
  const [opps, setOpps] = useState<VolunteerOpportunity[]>(initialOpportunities);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string, cat: string, remote: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (cat) params.set('category', cat);
      if (remote) params.set('remote', 'true');
      params.set('limit', '48');
      const res = await fetch(`/api/volunteers/opportunities?${params.toString()}`);
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();
      setOpps(json.opportunities ?? []);
    } catch {
      setError('Could not load opportunities. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query === '' && category === '' && !remoteOnly && opps === initialOpportunities) return;
    debounce.current = setTimeout(() => runSearch(query, category, remoteOnly), 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, remoteOnly]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search volunteer opportunities…"
            aria-label="Search opportunities"
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', fontSize: 14, color: 'var(--t1)', background: 'var(--bg)', outline: 'none' }}
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category"
          style={{ padding: '12px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', fontSize: 14, color: 'var(--t1)', background: 'var(--bg)', minWidth: 160 }}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only
        </label>
        {(query || category || remoteOnly) && (
          <Btn variant="ghost" size="sm" onClick={() => { setQuery(''); setCategory(''); setRemoteOnly(false); setOpps(initialOpportunities); }}>Clear</Btn>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--t3)' }}><Spinner /></div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Something went wrong" body={error}
          action={<Btn variant="secondary" onClick={() => runSearch(query, category, remoteOnly)}>Retry</Btn>} />
      ) : opps.length === 0 ? (
        <EmptyState icon="🙌" title="No opportunities found" body="Try a different search or clear the filters." />
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>{opps.length} {opps.length === 1 ? 'opportunity' : 'opportunities'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(240px, 100%, 300px), 1fr))', gap: 16 }}>
            {opps.map((o) => <OppCard key={o.id} opp={o} />)}
          </div>
        </>
      )}
    </div>
  );
}
