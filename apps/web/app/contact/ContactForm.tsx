'use client';

import type React from 'react';
import { useState } from 'react';

const SUBJECTS = [
  'Campaign support',
  'Donor question',
  'AI fundraising',
  'Billing or pricing',
  'Press inquiries',
  'Partnerships',
  'Other',
] as const;

function SendIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
  );
}

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [notice, setNotice] = useState('');

  const updateField = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setNotice('');

    const response = await fetch('/api/support-tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
        category: 'general',
        priority: 'normal',
      }),
    }).catch(() => null);

    if (response?.ok) {
      const payload = await response.json().catch(() => null) as { ticketId?: string } | null;
      setStatus('sent');
      setNotice(
        payload?.ticketId
          ? `Thanks — we logged ticket #${payload.ticketId.slice(0, 8).toUpperCase()} and will reply within 24 hours.`
          : "Thanks, your message is on its way. We'll get back to you soon.",
      );
      setForm({ name: '', email: '', subject: '', message: '' });
      return;
    }

    const payload = await response?.json().catch(() => null) as { error?: string } | null;
    setStatus('error');
    setNotice(payload?.error ?? 'Something went wrong. Please try again.');
  };

  return (
    <form className="ct-form" onSubmit={handleSubmit}>
      <div className="ct-form-head">
        <h2>Send us a message</h2>
        <p>Tell us what&apos;s going on — your message creates a real support ticket that our team tracks end to end.</p>
      </div>

      <div className="ct-form-row">
        <label>
          <span>Full Name</span>
          <input required value={form.name} onChange={updateField('name')} placeholder="Enter your full name" autoComplete="name" />
        </label>
        <label>
          <span>Email Address</span>
          <input required type="email" value={form.email} onChange={updateField('email')} placeholder="Enter your email" autoComplete="email" />
        </label>
      </div>

      <label>
        <span>Subject</span>
        <select required value={form.subject} onChange={updateField('subject')}>
          <option value="">Select a subject</option>
          {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
        </select>
      </label>

      <label>
        <span>Message</span>
        <textarea required value={form.message} onChange={updateField('message')} placeholder="How can we help you?" rows={5} />
      </label>

      {notice && <div className={`ct-notice ${status === 'sent' ? 'success' : 'error'}`}>{notice}</div>}

      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send Message'}
        <SendIcon className="ct-form-btn-ic" />
      </button>

      <div className="ct-privacy"><LockIcon /> Your message is encrypted and routed straight into our live support queue — never sold, never spammed.</div>
    </form>
  );
}
