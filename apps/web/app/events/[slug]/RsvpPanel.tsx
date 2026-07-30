'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Btn } from '../../../components/ui';

const linkButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14,
  padding: '10px 20px', borderRadius: 'var(--r)', background: 'var(--green-dark)', color: '#fff', textDecoration: 'none',
};

export default function RsvpPanel({
  eventId,
  signedIn,
  isOrganizer,
  open,
  alreadyRegistered,
  slug,
  free,
}: {
  eventId: string;
  signedIn: boolean;
  isOrganizer: boolean;
  open: boolean;
  alreadyRegistered: boolean;
  slug: string;
  /** False when the event sells paid ticket tiers. */
  free: boolean;
}) {
  const router = useRouter();
  const [registered, setRegistered] = useState(alreadyRegistered);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOrganizer) {
    return (
      <div style={{ fontSize: 14, color: 'var(--t3)' }}>
        This is your event.{' '}
        <Link href="/events/manage" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>Manage attendees →</Link>
      </div>
    );
  }

  if (registered) {
    return <p style={{ fontSize: 15, color: 'var(--green-dark)', fontWeight: 600 }}>🎉 You’re registered! We’ll see you there.</p>;
  }

  if (!signedIn) {
    return <Link href={`/login?next=/events/${slug}`} style={linkButtonStyle}>Sign in to RSVP</Link>;
  }

  if (!open) {
    return <p style={{ fontSize: 14, color: 'var(--t3)' }}>Registration is closed for this event.</p>;
  }

  async function rsvp() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not register.');
        return;
      }
      setRegistered(true);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Reserve your spot</h2>
      {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <Btn disabled={submitting} onClick={rsvp}>
        {submitting ? 'Registering…' : free ? 'RSVP — it’s free' : 'Reserve a free spot'}
      </Btn>
      {/* Registration here does not take payment. Saying "it's free" on an event
          that sells tickets would be a false price claim, so the paid tiers are
          named explicitly above and this CTA is scoped to the free RSVP. */}
      {!free && (
        <p style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 8, lineHeight: 1.5 }}>
          Paid tickets are listed above. This reserves a general-admission spot only.
        </p>
      )}
    </div>
  );
}
