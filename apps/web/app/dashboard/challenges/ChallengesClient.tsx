'use client';

import { useEffect, useState } from 'react';
import { Btn, Badge, Card, ProgressBar, EmptyState } from '../../../components/ui';

export type ChallengeView = {
  id: string;
  title: string;
  description: string | null;
  goalType: string;
  goalTargetCents: number;
  endsAt: string | null;
  joined: boolean;
  progress: number;
  progressPct: number;
};

export type BadgeView = {
  id: string;
  icon: string;
  label: string;
  description: string;
  earned: boolean;
};

function goalLabel(goalType: string, target: number): string {
  if (goalType === 'donation_count') return `${target} donation${target === 1 ? '' : 's'}`;
  return `$${(target / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} raised`;
}

function progressLabel(goalType: string, progress: number): string {
  if (goalType === 'donation_count') return `${progress}`;
  return `$${(progress / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function ChallengesClient({ initialChallenges, badges }: { initialChallenges: ChallengeView[]; badges: BadgeView[] }) {
  const [challenges, setChallenges] = useState<ChallengeView[]>(initialChallenges);
  const [busy, setBusy] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<BadgeView[]>(badges);
  const [newly, setNewly] = useState<string[]>([]);

  useEffect(() => {
    // Sync badges (awards any newly-earned) on mount.
    fetch('/api/badges')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.badges) return;
        setEarnedBadges(
          d.badges.map((b: { id: string; icon: string; label: string; description: string; awardedAt: string | null }) => ({
            id: b.id, icon: b.icon, label: b.label, description: b.description, earned: b.awardedAt != null,
          })),
        );
        if (Array.isArray(d.newlyAwarded)) setNewly(d.newlyAwarded);
      })
      .catch(() => {});
  }, []);

  async function toggleJoin(c: ChallengeView) {
    setBusy(c.id);
    try {
      const res = await fetch(`/api/challenges/${c.id}/join${c.joined ? '?action=leave' : ''}`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setChallenges((prev) => prev.map((x) => (x.id === c.id ? { ...x, joined: !!data.joined } : x)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Active challenges</h2>
        {challenges.length === 0 ? (
          <EmptyState icon="🏁" title="No active challenges" body="Check back soon — new giving challenges are added regularly." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {challenges.map((c) => (
              <div key={c.id} style={{ border: '1px solid var(--b2, #e5e7eb)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800 }}>{c.title}</h3>
                  {c.joined && <Badge color="green">Joined</Badge>}
                </div>
                {c.description && <p style={{ fontSize: 13, color: 'var(--t3)' }}>{c.description}</p>}
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>Goal: {goalLabel(c.goalType, c.goalTargetCents)}</div>
                {c.joined && (
                  <div>
                    <ProgressBar value={c.progress} max={Math.max(1, c.goalTargetCents)} />
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
                      {progressLabel(c.goalType, c.progress)} · {c.progressPct}%
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 'auto' }}>
                  <Btn variant={c.joined ? 'ghost' : 'primary'} onClick={() => toggleJoin(c)} loading={busy === c.id} disabled={busy === c.id}>
                    {c.joined ? 'Leave challenge' : 'Join challenge'}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Your badges</h2>
        {newly.length > 0 && (
          <div style={{ padding: '8px 12px', background: 'var(--green-light, #f0fff8)', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#065f46', marginBottom: 12 }}>
            🎉 You just earned {newly.length} new badge{newly.length === 1 ? '' : 's'}!
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 8 }}>
          {earnedBadges.map((b) => (
            <div key={b.id} style={{ textAlign: 'center', padding: 12, borderRadius: 12, border: '1px solid var(--b2, #e5e7eb)', opacity: b.earned ? 1 : 0.4 }}>
              <div style={{ fontSize: 32 }}>{b.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{b.label}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{b.description}</div>
              {b.earned ? (
                <Badge color="green">Earned</Badge>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Locked</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
