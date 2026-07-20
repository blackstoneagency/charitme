'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Btn, Badge, EmptyState, Spinner } from '../../../components/ui';
import { volunteerApplicationStatusLabel, type VolunteerApplicationStatus } from '../../../lib/volunteers';

interface AppRow {
  id: string;
  opportunity_id: string;
  status: VolunteerApplicationStatus;
  hours_logged: number;
  hours_verified: boolean;
  applied_at: string;
  volunteer_opportunities: { id: string; slug: string; title: string; org_name: string; is_remote: boolean; starts_at: string | null } | null;
}

const statusColor: Record<VolunteerApplicationStatus, 'green' | 'blue' | 'gray' | 'red'> = {
  applied: 'blue', accepted: 'green', declined: 'red', withdrawn: 'gray', completed: 'green',
};

export default function VolunteerApplicationsClient() {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch('/api/volunteers/applications')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((j) => { setApps(j.applications ?? []); setError(null); })
      .catch(() => { setApps([]); setError('Could not load your applications.'); });
  }

  useEffect(() => {
    fetch('/api/volunteers/applications')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((j) => { setApps(j.applications ?? []); setError(null); })
      .catch(() => { setApps([]); setError('Could not load your applications.'); });
  }, []);

  async function withdraw(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/volunteers/applications/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'withdrawn' }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed'); }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  if (apps === null) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--t3)' }}><Spinner /></div>;
  }

  if (apps.length === 0) {
    return (
      <EmptyState icon="🙌" title="No volunteer applications yet"
        body="Browse opportunities and apply — they'll show up here."
        action={<Link href="/volunteer"><Btn>Find opportunities</Btn></Link>} />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <div style={{ fontSize: 13, color: 'var(--red-text)' }}>{error}</div>}
      {apps.map((a) => (
        <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: 16 }}>
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge color={statusColor[a.status]}>{volunteerApplicationStatusLabel(a.status)}</Badge>
              {a.volunteer_opportunities && <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 700 }}>{a.volunteer_opportunities.org_name}</span>}
              {a.hours_verified && a.hours_logged > 0 && <span style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 700 }}>{a.hours_logged} hrs verified</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginTop: 4 }}>
              {a.volunteer_opportunities
                ? <Link href={`/volunteer/${a.volunteer_opportunities.slug}`}>{a.volunteer_opportunities.title}</Link>
                : 'Opportunity unavailable'}
            </div>
          </div>
          {(a.status === 'applied' || a.status === 'accepted') && (
            <Btn size="sm" variant="ghost" loading={busy === a.id} onClick={() => withdraw(a.id)}>Withdraw</Btn>
          )}
        </div>
      ))}
    </div>
  );
}
