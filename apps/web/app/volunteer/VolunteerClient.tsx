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
        <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>{opp.org_name}</span>
          {opp.verified && <Badge color="green">Verified</Badge>}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: 'var(--t1)', margin: 0 }}>{opp.title}</h2>
        {opp.summary && (
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{opp.summary}</p>
        )}
        {opp.skills.length > 0 && (
          <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 6 }}>
            {opp.skills.slice(0, 3).map((s) => <Badge key={s} color="blue">{s}</Badge>)}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--b1)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)' }}>{whenLabel(opp.starts_at, opp.is_remote)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: full ? 'var(--red-text)' : 'var(--green-text)' }}>
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
  // Whether the visitor narrowed anything. Drives which empty state shows: an
  // unfiltered empty list means "none listed yet", not "your search was too
  // narrow", and offering to clear filters nobody set is a dead end.
  const filtersActive = query.trim() !== '' || category !== '' || remoteOnly;
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
      <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
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
        {/* minHeight keeps the whole label — the actual tap target, since clicking
            it toggles the box — at the 24px minimum of WCAG 2.2 SC 2.5.8 (AA).
            It measured 113×20 at 320px. */}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 24, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only
        </label>
        {(query || category || remoteOnly) && (
          <Btn variant="ghost" size="sm" onClick={() => { setQuery(''); setCategory(''); setRemoteOnly(false); setOpps(initialOpportunities); }}>Clear</Btn>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', minWidth: 0, justifyContent: 'center', padding: 60, color: 'var(--t3)' }}><Spinner /></div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Something went wrong" body={error}
          action={<Btn variant="secondary" onClick={() => runSearch(query, category, remoteOnly)}>Retry</Btn>} />
      ) : opps.length === 0 ? (
        // "Your filter matched nothing" and "there are none listed yet" are
        // different facts, and telling someone to clear filters they never set
        // sends them in a circle. Same distinction the discovery pages draw
        // between an empty result and a failed read.
        filtersActive ? (
          <EmptyState
            icon="🙌"
            title="No opportunities match those filters"
            body="Try a broader search, or clear the filters to see everything on offer."
            action={<Btn variant="secondary" onClick={() => { setQuery(''); setCategory(''); setRemoteOnly(false); runSearch('', '', false); }}>Clear filters</Btn>}
          />
        ) : (
          <EmptyState
            icon="🙌"
            title="No volunteer opportunities listed yet"
            body="Nothing here right now. You can still give to a cause today, or list an opportunity if your organisation needs hands."
            action={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                <Link href="/campaigns" className="cta-primary" style={{ display: 'inline-flex' }}>Browse campaigns</Link>
                <Link href="/dashboard/volunteer" className="vol-btn-secondary">List an opportunity</Link>
              </div>
            }
          />
        )
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
