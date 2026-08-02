'use client';

import type React from 'react';
import { useState } from 'react';

// Posts to the EXISTING `/api/contact` endpoint rather than adding a second
// unauthenticated email route. That endpoint already has durable cross-instance
// rate limiting (5/min per IP) and validated input; a parallel route would
// double the spam surface and the Resend spend for no benefit.
//
// One deviation from the mockup, stated plainly on the page: it marks email
// "(optional)", but `/api/contact` requires a valid address because a human
// replies to these. Rather than weaken a validated endpoint or post a fake
// address that breaks the reply path, the field is required and the page says
// why.

const TYPES = [
  'Bug report',
  'Feature request',
  'Something is confusing',
  'Content or wording',
  'Accessibility issue',
  'Praise',
  'Other',
] as const;

const MAX_MESSAGE = 4000;

const field = {
  padding: '10px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--b2)',
  background: 'var(--s1)',
  color: 'var(--t1)',
  fontSize: '14px',
  width: '100%',
  fontFamily: 'inherit',
} as const;

export default function FeedbackForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: TYPES[0] as string, message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [notice, setNotice] = useState('');

  const update = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setNotice('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, subject: `Feedback — ${form.subject}` }),
      });
      if (!res.ok) {
        // Surface the real reason where it is actionable. A generic "something
        // went wrong" on a rate limit tells the person to retry immediately,
        // which is exactly wrong.
        const data = (await res.json().catch(() => null)) as { code?: string } | null;
        setStatus('error');
        setNotice(
          data?.code === 'RATE_LIMITED'
            ? 'That is a lot of feedback in a short time. Please wait a minute and try again.'
            : 'We could not send that just now. Please try again in a moment.',
        );
        return;
      }
      setStatus('sent');
      setNotice('Thank you — your feedback reached us.');
      setForm({ name: '', email: '', subject: TYPES[0], message: '' });
    } catch {
      setStatus('error');
      setNotice('We could not send that just now. Please try again in a moment.');
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '14px', maxWidth: '560px' }}>
      <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Type of feedback</span>
        <select value={form.subject} onChange={update('subject')} style={field} required>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Your name</span>
        <input value={form.name} onChange={update('name')} required minLength={2} maxLength={120} style={field} />
      </label>

      <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Email</span>
        <input type="email" value={form.email} onChange={update('email')} required maxLength={180} style={field} />
        <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
          A person reads and replies to these, so we need somewhere to reply to.
        </span>
      </label>

      <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Your message</span>
        <textarea
          value={form.message}
          onChange={update('message')}
          required
          minLength={10}
          maxLength={MAX_MESSAGE}
          rows={6}
          placeholder="What happened, what you expected, and where on the site you were."
          style={{ ...field, resize: 'vertical' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
          {form.message.length}/{MAX_MESSAGE}
        </span>
      </label>

      <div>
        <button
          type="submit"
          className="kind-start-pill"
          disabled={status === 'sending'}
          style={{ display: 'inline-flex', justifyContent: 'center', minHeight: '42px', opacity: status === 'sending' ? 0.6 : 1 }}
        >
          {status === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
      </div>

      {/* aria-live so the outcome is announced rather than only seen. */}
      <p
        role="status"
        aria-live="polite"
        style={{
          minHeight: '20px',
          margin: 0,
          fontSize: '13px',
          fontWeight: 650,
          color: status === 'error' ? 'var(--red-text, var(--red))' : 'var(--green-text)',
        }}
      >
        {notice}
      </p>
    </form>
  );
}
