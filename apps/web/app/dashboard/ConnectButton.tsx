'use client';
import React, { useEffect, useState } from 'react';
import { Btn } from '../../components/ui';

type ConnectStatus = {
  connected: boolean;
  onboarded: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  resumeUrl?: string | null;
  stale?: boolean;
};

export default function ConnectButton() {
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus]     = useState<ConnectStatus | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await fetch('/api/stripe/connect/status');
        if (r.ok && active) setStatus(await r.json());
      } catch { /* non-fatal */ } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // If there's a resume URL (incomplete onboarding), go directly there
      if (status?.resumeUrl) {
        window.location.href = status.resumeUrl;
        return;
      }
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  if (checking) {
    return <Btn loading variant="primary">Checking…</Btn>;
  }

  // Fully onboarded and enabled
  if (status?.connected && status.onboarded && status.chargesEnabled && status.payoutsEnabled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 700 }}>✓ Stripe connected</span>
        <Btn onClick={handleConnect} loading={loading} variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
          Manage
        </Btn>
      </div>
    );
  }

  // Connected but onboarding incomplete
  if (status?.connected && !status.onboarded) {
    return (
      <div>
        <div style={{ fontSize: 12, color: 'var(--orange-text)', fontWeight: 700, marginBottom: 4 }}>
          ⚠️ Stripe setup incomplete
        </div>
        <Btn onClick={handleConnect} loading={loading} variant="primary">
          Complete Setup
        </Btn>
      </div>
    );
  }

  // Not connected at all
  return (
    <Btn onClick={handleConnect} loading={loading} variant="primary">
      Connect Stripe
    </Btn>
  );
}
