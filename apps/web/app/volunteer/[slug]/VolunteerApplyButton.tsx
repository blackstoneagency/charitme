'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Textarea } from '../../../components/ui';

export default function VolunteerApplyButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/volunteers/opportunities/${slug}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || undefined }),
      });
      if (res.status === 401) { router.push(`/login?next=/volunteer/${slug}`); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not apply');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--green-light)', color: 'var(--green-dark)', fontSize: 14, fontWeight: 700 }}>
          ✓ Application submitted
        </div>
        <Btn variant="secondary" onClick={() => router.push('/dashboard/volunteer')} style={{ width: '100%' }}>
          View my applications
        </Btn>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {open && (
        <Textarea
          label="Message to the organizer (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share why you'd be a great fit…"
          style={{ minHeight: 90 }}
        />
      )}
      <Btn size="lg" loading={loading} onClick={() => (open ? submit() : setOpen(true))} style={{ width: '100%' }}>
        {open ? 'Submit application' : 'Apply to volunteer'}
      </Btn>
      {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
    </div>
  );
}
