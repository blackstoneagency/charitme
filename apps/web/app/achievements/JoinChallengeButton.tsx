'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn } from '../../components/ui';

export default function JoinChallengeButton({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/gamification/challenges/${challengeId}/join`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErr(json.error ?? 'Could not join.');
        return;
      }
      router.refresh();
    } catch {
      setErr('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <Btn size="sm" disabled={busy} onClick={join}>{busy ? 'Joining…' : 'Join challenge'}</Btn>
      {err && <div style={{ color: 'var(--red-text)', fontSize: 12, marginTop: 4 }}>{err}</div>}
    </div>
  );
}
