'use client';

import React, { useCallback, useEffect, useState } from 'react';

/**
 * Turn web push on or off for THIS device.
 *
 * Push is per-device, not per-account: granting permission on a laptop says
 * nothing about a phone. So this reads live browser state on mount rather than
 * a stored preference — a toggle that showed "on" because the account has a
 * subscription somewhere else would be lying about the device in front of you.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** VAPID keys travel as base64url; `applicationServerKey` wants raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // Backed by an explicit ArrayBuffer: `applicationServerKey` is a BufferSource,
  // which excludes a SharedArrayBuffer-backed view.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State =
  | { kind: 'checking' }
  /** No keypair on this deployment, or the browser has no push at all. */
  | { kind: 'unavailable'; reason: string }
  /** Permission was denied at the OS/browser level — we cannot re-ask. */
  | { kind: 'blocked' }
  | { kind: 'off' }
  | { kind: 'on' };

export default function PushToggle() {
  const [state, setState] = useState<State>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      setState({ kind: 'unavailable', reason: 'Push notifications are not enabled on this deployment yet.' });
      return;
    }
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState({ kind: 'unavailable', reason: 'This browser does not support push notifications.' });
      return;
    }
    // iOS delivers push only to a site installed to the Home Screen. Saying so
    // is the difference between "this app is broken" and "here is what to do".
    if (Notification.permission === 'denied') { setState({ kind: 'blocked' }); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setState({ kind: sub ? 'on' : 'off' });
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state resolves after the async browser lookups above
  useEffect(() => { void refresh(); }, [refresh]);

  async function enable() {
    setBusy(true); setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState({ kind: permission === 'denied' ? 'blocked' : 'off' }); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        // Required by every browser: a push must result in something the user
        // sees. A silent push is grounds for revoking the permission entirely.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        // The browser now has a subscription the server does not know about.
        // Leaving it would show "on" while nothing ever arrives, so it goes.
        await sub.unsubscribe().catch(() => {});
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'Could not register this device.');
        setState({ kind: 'off' });
        return;
      }
      setState({ kind: 'on' });
    } catch {
      setError('Could not turn on notifications for this device.');
      setState({ kind: 'off' });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true); setError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Server first: if the row survived a failed unsubscribe we would keep
        // pushing to a device that has already stopped listening.
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState({ kind: 'off' });
    } catch {
      setError('Could not turn off notifications for this device.');
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === 'checking') return null;

  const note = state.kind === 'unavailable' ? state.reason
    : state.kind === 'blocked'
      ? 'Blocked in your browser settings. Allow notifications for charitme.com, then come back. On iPhone, add CharitMe to your Home Screen first — Safari only delivers notifications to installed apps.'
      : 'Get a notification the moment someone donates. Applies to this device only.';

  return (
    <div className="kf-setpref">
      <div className="kf-setpref-info">
        <strong>Push notifications on this device</strong>
        <span>{note}</span>
        {error && <span style={{ color: 'var(--red-text)' }}>{error}</span>}
      </div>
      {state.kind === 'on' || state.kind === 'off' ? (
        <button
          type="button"
          onClick={() => void (state.kind === 'on' ? disable() : enable())}
          disabled={busy}
          aria-pressed={state.kind === 'on'}
          style={{
            fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '7px 16px', cursor: busy ? 'wait' : 'pointer',
            border: '1px solid var(--b1)', background: state.kind === 'on' ? 'var(--s3)' : 'var(--s1)',
            color: state.kind === 'on' ? 'var(--green-text)' : 'var(--t1)',
          }}
        >
          {busy ? 'Working…' : state.kind === 'on' ? 'Turn off' : 'Turn on'}
        </button>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--t3)' }}>Unavailable</span>
      )}
    </div>
  );
}
