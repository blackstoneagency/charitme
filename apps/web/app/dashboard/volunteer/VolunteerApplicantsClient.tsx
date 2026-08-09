'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, BtnLink } from '../../../components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Organizer-side applicant review.
//
// Volunteers could apply and the accept/decline endpoint existed, but nothing in
// the product ever listed who had applied — so applications went unread and
// unanswerable. This is that missing surface, and it is also the first thing to
// display `volunteer_profiles` (skills / availability), which had 1131 rows in
// production and no reader.
// ─────────────────────────────────────────────────────────────────────────────

type Applicant = {
  id: string;
  opportunityId: string;
  status: string;
  message: string | null;
  hoursLogged: number;
  appliedAt: string;
  decidedAt: string | null;
  name: string;
  avatarUrl: string | null;
  profile: {
    headline: string | null;
    bio: string | null;
    skills: string[];
    interests: string[];
    location: string | null;
    availability: string | null;
    remoteOk: boolean;
  } | null;
};

type Opportunity = {
  id: string;
  slug: string;
  title: string;
  slots: number | null;
  slotsFilled: number;
  status: string;
};

type Decision = 'accepted' | 'declined' | 'completed';

const STATUS_LABEL: Record<string, string> = {
  applied: 'Applied',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  completed: 'Completed',
};

function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    applied: { bg: 'var(--s2)', fg: 'var(--t2)' },
    accepted: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
    declined: { bg: 'var(--s2)', fg: 'var(--t3)' },
    withdrawn: { bg: 'var(--s2)', fg: 'var(--t3)' },
    completed: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
  };
  const c = map[status] ?? map.applied;
  return {
    background: c.bg, color: c.fg, padding: '2px 9px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
  };
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VolunteerApplicantsClient() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/volunteers/applicants');
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      setOpportunities(json.opportunities ?? []);
      setApplicants(json.applicants ?? []);
      setFailed(false);
    } catch {
      // Not "you have no applicants" — say the read failed, per the degraded-read
      // rule the dashboard now follows everywhere.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // The fetch chain is started inside the effect rather than calling `load()`
  // directly: the lint rule forbids an effect that may setState synchronously, and
  // every setState below happens in a promise callback.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/volunteers/applicants')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((json) => {
        if (cancelled) return;
        setOpportunities(json.opportunities ?? []);
        setApplicants(json.applicants ?? []);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const titleById = useMemo(
    () => new Map(opportunities.map((o) => [o.id, o.title])),
    [opportunities],
  );

  const pending = applicants.filter((a) => a.status === 'applied');
  const decided = applicants.filter((a) => a.status !== 'applied');

  async function decide(id: string, decision: Decision) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/volunteers/applications/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not update this application');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--t3)', fontSize: 14 }}>Loading applicants…</p>;
  }

  if (failed) {
    return (
      <div role="alert" style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--b2)', color: 'var(--t1)' }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>We couldn&apos;t load your applicants</strong>
        <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          This is a temporary problem on our side — no applications have been lost.
          Reload the page to try again.
        </span>
      </div>
    );
  }

  if (opportunities.length === 0) {
    // Shared EmptyState, matching "Your applications" on this page rather than
    // rendering the same idea as loose text.
    return (
      <EmptyState
        icon="📣"
        title="No opportunities posted yet"
        body="Post an opportunity and the people who apply to it will appear here."
        // ⚠️ /volunteer/manage 404s — checked, not assumed. The manage route is
        // per-opportunity (/volunteer/manage/[id]), so there is no index to link
        // to. Sending someone to browse is honest; a dead CTA is not.
        action={<BtnLink href="/volunteer">Browse opportunities</BtnLink>}
      />
    );
  }

  if (applicants.length === 0) {
    return (
      <EmptyState
        icon="🙌"
        title="No applicants yet"
        body={`Nobody has applied to your ${opportunities.length === 1 ? 'opportunity' : 'opportunities'} yet. Sharing the listing is the fastest way to reach volunteers.`}
      />
    );
  }

  const card = (a: Applicant) => (
    <li
      key={a.id}
      style={{
        border: '1px solid var(--b2)', borderRadius: 12, padding: '14px 16px',
        background: 'var(--s1)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10,
      }}
    >
      <div style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 15, color: 'var(--t1)' }}>{a.name}</strong>
          {a.profile?.headline && (
            <span style={{ display: 'block', fontSize: 13, color: 'var(--t2)', marginTop: 2 }}>{a.profile.headline}</span>
          )}
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--t3)', marginTop: 3 }}>
            {titleById.get(a.opportunityId) ?? 'Opportunity'} · applied {when(a.appliedAt)}
          </span>
        </div>
        <span style={statusStyle(a.status)}>{STATUS_LABEL[a.status] ?? a.status}</span>
      </div>

      {a.profile && (
        <div style={{ display: 'flex', minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
          {a.profile.skills.slice(0, 8).map((s) => (
            <span key={s} style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--s2)', color: 'var(--t2)' }}>
              {s}
            </span>
          ))}
          {a.profile.availability && (
            <span style={{ fontSize: 11.5, color: 'var(--t3)', alignSelf: 'center' }}>
              · {a.profile.availability}
            </span>
          )}
          {a.profile.remoteOk && (
            <span style={{ fontSize: 11.5, color: 'var(--t3)', alignSelf: 'center' }}>· open to remote</span>
          )}
        </div>
      )}

      {a.message && (
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--t2)', margin: 0, whiteSpace: 'pre-wrap' }}>
          “{a.message}”
        </p>
      )}

      {a.status === 'applied' && (
        <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="kf-primary"
            disabled={busyId === a.id}
            onClick={() => void decide(a.id, 'accepted')}
          >
            {busyId === a.id ? 'Saving…' : 'Accept'}
          </button>
          <button
            type="button"
            className="kf-outline"
            disabled={busyId === a.id}
            onClick={() => void decide(a.id, 'declined')}
          >
            Decline
          </button>
        </div>
      )}

      {a.status === 'accepted' && (
        <div>
          <button
            type="button"
            className="kf-outline"
            disabled={busyId === a.id}
            onClick={() => void decide(a.id, 'completed')}
          >
            {busyId === a.id ? 'Saving…' : 'Mark completed'}
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
      {error && (
        <p role="alert" style={{ color: 'var(--red-text)', fontSize: 13.5, margin: 0 }}>{error}</p>
      )}

      <section>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>
          Awaiting your decision{pending.length > 0 ? ` (${pending.length})` : ''}
        </h3>
        {pending.length === 0 ? (
          <p style={{ color: 'var(--t3)', fontSize: 13.5, margin: 0 }}>Nothing waiting on you.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {pending.map(card)}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Decided ({decided.length})</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {decided.map(card)}
          </ul>
        </section>
      )}
    </div>
  );
}
