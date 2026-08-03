'use client';

import type React from 'react';
import { useState } from 'react';

/**
 * Design 32 — the subscribe form.
 *
 * It posts to `/api/marketing/capture`, which find-or-creates a row in
 * `marketing_contacts`, stitches the email identity, writes a `marketing_consent`
 * row, and records a `newsletter_signup` event. This is the SAME endpoint the
 * donation and popup captures use, so a subscriber shows up in /admin/marketing
 * alongside every other contact rather than in a parallel list.
 *
 * `consentEmail: true` is sent because subscribing IS the consent — the address
 * was typed into a box whose only purpose is receiving email. It is not inferred
 * from a pre-ticked box anywhere else.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setNotice('');

    const response = await fetch('/api/marketing/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        clientType: 'newsletter',
        event: 'newsletter_signup',
        consentEmail: true,
        url: typeof window === 'undefined' ? undefined : window.location.href,
      }),
    }).catch(() => null);

    if (response?.ok) {
      setStatus('done');
      // Deliberately the same wording whether the address was new or already on
      // the list. A distinct reply for a known address turns this open,
      // unauthenticated endpoint into a membership oracle for any email.
      setNotice("You're on the list. The next issue goes out at the start of the month.");
      setEmail('');
      setFirstName('');
      return;
    }

    // 429 is its own message: "try again" is actively wrong advice for a rate
    // limit, and the generic error would have people retrying into the block.
    if (response?.status === 429) {
      setStatus('error');
      setNotice('Too many attempts from this network. Please wait a minute and try again.');
      return;
    }

    const payload = (await response?.json().catch(() => null)) as { error?: string } | null;
    setStatus('error');
    setNotice(payload?.error ?? 'We could not save that just now. Please try again.');
  };

  return (
    <form className="contact-form-card-v2" onSubmit={handleSubmit} aria-labelledby="newsletter-form-heading">
      <div className="contact-form-glow" aria-hidden="true" />
      <div className="contact-form-head">
        <span className="contact-form-badge">✦ Monthly, not daily</span>
        <h2 id="newsletter-form-heading">Subscribe</h2>
        <p>One email a month. Unsubscribe from any of them in one click.</p>
      </div>

      <div className="contact-form-grid">
        <label>
          <span>First name (optional)</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Your first name"
            autoComplete="given-name"
            maxLength={80}
          />
        </label>
        <label>
          <span>Email address</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
          />
        </label>
      </div>

      {/* role=status + aria-live so a screen reader hears the result. Without it
          the only feedback is a visual colour change the user never receives. */}
      {notice && (
        <div className={`contact-notice-v2 ${status === 'done' ? 'success' : 'error'}`} role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Subscribing…' : 'Subscribe'}
      </button>

      <div className="contact-privacy-v2">
        We store your address to send this newsletter and nothing else. We do not sell it. Every issue carries a
        one-click unsubscribe link, and you can{' '}
        <a href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>
          read the privacy policy
        </a>{' '}
        in full.
      </div>
    </form>
  );
}
