'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CommentForm({
  campaignId,
  isAuthenticated,
  loginNext,
}: {
  campaignId: string;
  isAuthenticated: boolean;
  loginNext: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--b1)', background: 'var(--s2)', fontSize: 13, color: 'var(--t2)', marginBottom: 16 }}>
        <Link href={`/login?next=${encodeURIComponent(loginNext)}`} style={{ color: 'var(--violet)', fontWeight: 800, textDecoration: 'none' }}>Sign in</Link> to leave a message of support.
      </div>
    );
  }

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, anonymous }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not post your message.');
      setMessage('');
      setAnonymous(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not post your message.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <textarea
        aria-label="Message of support"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
        placeholder="Leave a message of support…"
        rows={3}
        maxLength={1000}
        style={{
          width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--b2)', borderRadius: 12,
          padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
          background: 'var(--s1, #fff)', color: 'var(--t1)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: 'var(--violet)' }}
          />
          Post anonymously
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !message.trim()}
          style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13,
            background: submitting || !message.trim() ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)',
            color: '#fff', cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
      {error && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#ef4444', fontWeight: 600 }}>⚠ {error}</p>}
    </div>
  );
}
