'use client';

import React, { useCallback, useEffect, useState } from 'react';

/**
 * Opt in to donation alerts on this device.
 *
 * Without this control the subscribe endpoint is never called and the whole push
 * feature is inert, so it is part of shipping push rather than a nicety.
 *
 * ⚠️ EVERY unsupported case renders NOTHING rather than a dead button. Push needs
 * a service worker, the Push API, Notification permission AND a configured VAPID
 * key, and on iOS it additionally requires the site to be INSTALLED to the home
 * screen — a Safari tab cannot subscribe at all. Offering a control that cannot
 * work is worse than offering none: the person taps it, nothing happens, and
 * they conclude the product is broken.
 */

type State =
  | 'checking'      // feature-detecting, or asking the server whether push is on
  | 'unsupported'   // this browser/context can never do it — render nothing
  | 'unconfigured'  // server has no VAPID key — render nothing
  | 'denied'        // permission refused; explain, do not re-prompt
  | 'off'
  | 'on'
  | 'working';

/**
 * base64url → ArrayBuffer, the form PushManager.subscribe demands.
 *
 * Returns the underlying ArrayBuffer rather than the view: TS 5.7 types
 * `applicationServerKey` as `ArrayBufferView<ArrayBuffer>`, and a plain
 * `Uint8Array` is `Uint8Array<ArrayBufferLike>`, which does not satisfy it.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export default function PushOptIn() {
  const [state, setState] = useState<State>('checking');
  const [error, setError] = useState<string | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
      if (!supported) { if (!cancelled) setState('unsupported'); return; }
      if (!vapidKey) { if (!cancelled) setState('unconfigured'); return; }

      if (Notification.permission === 'denied') { if (!cancelled) setState('denied'); return; }

      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setState(existing ? 'on' : 'off');
      } catch {
        if (!cancelled) setState('unsupported');
      }
    })();
    return () => { cancelled = true; };
  }, [vapidKey]);

  const enable = useCallback(async () => {
    setError(null);
    setState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidKey as string),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        // Roll the browser subscription back. Leaving it in place would mean the
        // browser thinks this device is subscribed while the server has no row —
        // the device then looks opted-in forever and never receives anything.
        await sub.unsubscribe().catch(() => {});
        setState('off');
        setError(res.status === 503
          ? 'Push is not switched on for this site yet.'
          : 'Could not save your subscription. Please try again.');
        return;
      }
      setState('on');
    } catch {
      setState('off');
      setError('Could not enable alerts on this device.');
    }
  }, [vapidKey]);

  const disable = useCallback(async () => {
    setError(null);
    setState('working');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState('off');
    } catch {
      setState('off');
    }
  }, []);

  // Render nothing at all when it could never work — see the note at the top.
  if (state === 'checking' || state === 'unsupported' || state === 'unconfigured') return null;

  return (
    <div style={{
      border: '1px solid var(--b1)', background: 'var(--s1)', borderRadius: 12,
      padding: '14px 16px', marginBottom: 18, display: 'flex', alignItems: 'center',
      gap: 14, flexWrap: 'wrap',
    }}>
      <span aria-hidden="true" style={{ fontSize: 22 }}>🔔</span>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 14, color: 'var(--t1)' }}>
          Donation alerts on this device
        </strong>
        <span style={{ fontSize: 13, color: 'var(--t3)' }}>
          {state === 'denied'
            ? 'Notifications are blocked for this site in your browser settings.'
            : 'Get a notification the moment someone donates to your campaign.'}
        </span>
        {error && (
          <span role="alert" style={{ display: 'block', fontSize: 13, color: 'var(--red-text)', marginTop: 4 }}>
            {error}
          </span>
        )}
      </div>
      {state !== 'denied' && (
        <button
          type="button"
          onClick={state === 'on' ? disable : enable}
          disabled={state === 'working'}
          style={{
            minHeight: 44, padding: '0 18px', borderRadius: 10, cursor: 'pointer',
            border: state === 'on' ? '1px solid var(--b2)' : 'none',
            // ⚠️ --green-dark (#08763b, 5.73:1 on white), NOT --green (#12a653,
            // 3.18:1). This is 14px/650 so AA wants 4.5:1, and --green fails it.
            // The same token choice was the WCAG failure fixed across 12 rules
            // earlier today; it is easy to reach for the brand fill by reflex.
            background: state === 'on' ? 'transparent' : 'var(--green-dark)',
            color: state === 'on' ? 'var(--t2)' : '#fff',
            fontSize: 14, fontWeight: 650,
            opacity: state === 'working' ? 0.6 : 1,
          }}
        >
          {state === 'working' ? 'Working…' : state === 'on' ? 'Turn off' : 'Turn on'}
        </button>
      )}
    </div>
  );
}
