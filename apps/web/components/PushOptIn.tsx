'use client';

import React, { useEffect, useState } from 'react';
import { Btn } from './ui';

/**
 * The push opt-in control.
 *
 * ⚠️ **It never prompts on load, and that is a requirement rather than a
 * preference.** A permission prompt fired on page load is the single most
 * disliked pattern on the web: Chrome shows it as a muted chip instead of a
 * dialog for origins with a low grant rate, and Safari ignores it entirely
 * unless it follows a user gesture. So the browser dialog only ever opens from
 * a click on the button below — a user who says no here can be asked again
 * later; a user who says no to the browser dialog cannot be asked ever again
 * without visiting site settings by hand.
 *
 * Rendered in dashboard settings, not on a public page, because the thing it
 * offers — "tell me when a gift arrives" — only means something to someone who
 * runs a campaign.
 */

function urlBase64ToUint8Array(base64: string): BufferSource {
  // VAPID keys are URL-safe base64 without padding; `atob` needs both fixed.
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  // Backed by an explicit ArrayBuffer: `Uint8Array.from` produces
  // `Uint8Array<ArrayBufferLike>`, which no longer satisfies `BufferSource`
  // under TS 5.9's stricter typed-array generics.
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

type State = 'unsupported' | 'denied' | 'off' | 'on' | 'working';

export default function PushOptIn({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>('off');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // ⚠️ The whole probe runs inside an async IIFE so no `setState` happens in
    // the effect's synchronous body — that is a cascading render, and
    // `react-hooks/set-state-in-effect` rejects it. Deriving the initial state in
    // a lazy `useState` initializer instead would hydrate differently on the
    // server, where `Notification` does not exist.
    void (async () => {
      // Feature detection, not user-agent sniffing: iOS supports this only when
      // the site is installed to the home screen, and there is no reliable
      // string for "installed".
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setState(subscription ? 'on' : 'off');
      } catch {
        if (!cancelled) setState('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState('working');
    setError('');
    try {
      // The gesture is here. Requesting inside the click handler is what makes
      // Safari show the dialog at all.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required by Chrome: a subscription that can send silent pushes is
        // refused outright.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
      if (!res.ok) {
        // Leave no orphan: a browser subscription the server does not know about
        // means a device that will never receive anything and cannot be told why.
        await subscription.unsubscribe().catch(() => {});
        setError('Could not turn on alerts. Try again shortly.');
        setState('off');
        return;
      }
      setState('on');
    } catch {
      setError('Could not turn on alerts on this device.');
      setState('off');
    }
  }

  async function disable() {
    setState('working');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {});
        await subscription.unsubscribe().catch(() => {});
      }
      setState('off');
    } catch {
      setState('on');
    }
  }

  if (state === 'unsupported') {
    return (
      <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0, lineHeight: 1.6 }}>
        This browser cannot show donation alerts. On iPhone, add CharitMe to your
        home screen first — notifications work once it is installed.
      </p>
    );
  }

  if (state === 'denied') {
    return (
      <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0, lineHeight: 1.6 }}>
        Notifications are blocked for CharitMe in this browser. We cannot ask
        again from here — turn them back on in your browser&rsquo;s site settings.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0, lineHeight: 1.6 }}>
        Get a notification the moment a gift arrives, without opening CharitMe.
      </p>
      {error && (
        <p role="alert" style={{ fontSize: 13.5, color: 'var(--red-text)', margin: 0 }}>{error}</p>
      )}
      {state === 'on' ? (
        <div style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--green-text, var(--t1))' }}>
            Alerts are on for this device
          </span>
          <Btn variant="ghost" onClick={() => void disable()}>Turn off</Btn>
        </div>
      ) : (
        <div>
          <Btn disabled={state === 'working'} onClick={() => void enable()}>
            {state === 'working' ? 'Turning on…' : 'Turn on donation alerts'}
          </Btn>
        </div>
      )}
    </div>
  );
}
