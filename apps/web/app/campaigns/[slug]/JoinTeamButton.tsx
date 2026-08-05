'use client';

import React, { useState } from 'react';
import { Btn } from '../../../components/ui';

// The write half of peer-to-peer fundraising. Without this the Fundraising team
// section could only ever display rows that arrived by other means.
export default function JoinTeamButton({
  campaignSlug,
  isSignedIn,
  alreadyOnTeam,
}: {
  campaignSlug: string;
  isSignedIn: boolean;
  alreadyOnTeam: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (alreadyOnTeam || done) {
    return (
      <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: '12px 0 0' }}>
        You&rsquo;re on this fundraising team. Share your page to start raising.
      </p>
    );
  }

  // Signed-out supporters get a link that returns them here, not a button that
  // fails on click — the API would 401 and the friction lands after the effort.
  if (!isSignedIn) {
    return (
      <a
        href={`/login?next=${encodeURIComponent(`/campaigns/${campaignSlug}`)}`}
        style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--green-text)' }}
      >
        Sign in to fundraise for this campaign →
      </a>
    );
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignSlug)}/peer-fundraisers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Could not join the team.');
      }
      setDone(true);
      // The team list is server-rendered, so a refresh is what shows the new page.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the team.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <Btn size="sm" variant="secondary" loading={busy} onClick={join}>
        Fundraise for this campaign
      </Btn>
      {error && (
        <p role="alert" style={{ fontSize: 12.5, color: 'var(--red)', margin: '8px 0 0' }}>{error}</p>
      )}
    </div>
  );
}
