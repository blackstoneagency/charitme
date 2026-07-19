'use client';

import { useState } from 'react';
import { Btn, Input, Textarea, Select, Badge, Card, EmptyState } from '../../../components/ui';

export type AdminChallenge = {
  id: string;
  title: string;
  description: string | null;
  goalType: string;
  goalTargetCents: number;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  participantCount: number;
};

function statusColor(status: string): 'green' | 'red' | 'blue' | 'gray' {
  if (status === 'active') return 'green';
  if (status === 'ended') return 'blue';
  return 'gray';
}

function goalLabel(goalType: string, target: number): string {
  if (goalType === 'donation_count') return `${target} donations`;
  return `$${(target / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function AdminChallengesClient({ initialChallenges }: { initialChallenges: AdminChallenge[] }) {
  const [challenges, setChallenges] = useState<AdminChallenge[]>(initialChallenges);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', goalType: 'donation_total', goalTarget: '', endsAt: '' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const goalTargetCents = form.goalType === 'donation_count'
        ? Math.max(0, parseInt(form.goalTarget, 10) || 0)
        : Math.max(0, Math.round((parseFloat(form.goalTarget) || 0) * 100));
      const res = await fetch('/api/admin/challenges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          goalType: form.goalType,
          goalTargetCents,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
          status: 'draft',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not create challenge'); return; }
      const c = data.challenge;
      setChallenges((prev) => [
        { id: c.id, title: c.title, description: c.description, goalType: c.goal_type, goalTargetCents: c.goal_target_cents, startsAt: c.starts_at, endsAt: c.ends_at, status: c.status, participantCount: 0 },
        ...prev,
      ]);
      setForm({ title: '', description: '', goalType: 'donation_total', goalTarget: '', endsAt: '' });
    } finally { setBusy(false); }
  }

  async function setStatus(id: string, status: 'active' | 'draft' | 'ended') {
    const res = await fetch(`/api/admin/challenges/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) setChallenges((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Create a challenge</h2>
        <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Summer of Giving)" aria-label="Challenge title" />
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this challenge about?" aria-label="Description" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <Select value={form.goalType} onChange={(e) => setForm({ ...form, goalType: e.target.value })} aria-label="Goal type">
                <option value="donation_total">Total raised ($)</option>
                <option value="donation_count">Number of donations</option>
              </Select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <Input type="number" min={0} value={form.goalTarget} onChange={(e) => setForm({ ...form, goalTarget: e.target.value })} placeholder={form.goalType === 'donation_count' ? 'Target count' : 'Target $'} aria-label="Goal target" />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} aria-label="Ends at (optional)" />
            </div>
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}
          <div><Btn type="submit" loading={busy} disabled={busy || form.title.trim().length < 4}>Create draft challenge</Btn></div>
        </form>
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>All challenges</h2>
        {challenges.length === 0 ? (
          <EmptyState icon="🏁" title="No challenges yet" body="Create a draft above, then publish it to make it visible to donors." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {challenges.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                    Goal: {goalLabel(c.goalType, c.goalTargetCents)} · {c.participantCount} joined
                    {c.endsAt ? ` · ends ${new Date(c.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge color={statusColor(c.status)}>{c.status}</Badge>
                  {c.status === 'draft' && <Btn size="sm" onClick={() => setStatus(c.id, 'active')}>Publish</Btn>}
                  {c.status === 'active' && <Btn size="sm" variant="ghost" onClick={() => setStatus(c.id, 'ended')}>End</Btn>}
                  {c.status === 'ended' && <Btn size="sm" variant="ghost" onClick={() => setStatus(c.id, 'active')}>Reopen</Btn>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
