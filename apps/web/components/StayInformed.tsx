'use client';

import type React from 'react';
import { useState } from 'react';

/**
 * The reference's "Stay informed" band.
 *
 * Posts to `/api/marketing/capture` — the SAME endpoint `/newsletter` uses, so a
 * subscriber captured here lands in `marketing_contacts` with a
 * `marketing_consent` row beside every other contact, rather than in a second
 * list that nobody maintains. `consentEmail: true` because typing an address
 * into a box whose only purpose is receiving email IS the consent.
 *
 * A subscribe box that posts nowhere is the "appears complete but is not
 * connected to the backend" failure; this one is wired to the real path
 * including the re-subscribe fix, so someone who previously unsubscribed is
 * genuinely re-activated rather than silently left suppressed.
 */
export default function StayInformed() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [notice, setNotice] = useState('');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setNotice('');

    const res = await fetch('/api/marketing/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        clientType: 'newsletter',
        event: 'newsletter_signup',
        consentEmail: true,
        url: typeof window === 'undefined' ? undefined : window.location.href,
      }),
    }).catch(() => null);

    if (res?.ok) {
      setStatus('done');
      // Identical wording whether the address was new or already on the list:
      // a distinct reply would turn this open endpoint into a membership oracle.
      setNotice('You’re on the list. One email a month, unsubscribe in one click.');
      setEmail('');
      return;
    }
    if (res?.status === 429) {
      setStatus('error');
      setNotice('Too many attempts from this network. Please wait a minute and try again.');
      return;
    }
    setStatus('error');
    setNotice('We could not save that just now. Please try again.');
  };

  return (
    <section className="cx-stay" aria-labelledby="cx-stay-title">
      <div className="cx-stay-copy">
        <h2 id="cx-stay-title">Stay informed</h2>
        <p>One email a month — what got funded, and what changed on CharitMe.</p>
      </div>
      <form className="cx-stay-form" onSubmit={submit}>
        <label htmlFor="cx-stay-email" className="cx-visually-hidden">Email address</label>
        <input
          id="cx-stay-email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {notice && (
        <p className={`cx-stay-note${status === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </section>
  );
}
