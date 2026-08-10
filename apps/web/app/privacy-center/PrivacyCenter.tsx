'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DELETION_CONFIRMATION, isConfirmed } from '../../lib/account-deletion';
import { Btn, Input, Textarea, Badge, Card } from '../../components/ui';
import type { PrivacyRequest } from '../../lib/privacy-core';

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'red' | 'blue'> = {
  pending: 'blue',
  in_progress: 'blue',
  completed: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

export default function PrivacyCenter({
  initialRequests,
  selfDeleteEnabled,
}: {
  initialRequests: PrivacyRequest[];
  // ⚠️ Resolved on the SERVER and passed down. Reading the flag in the client
  // would need a NEXT_PUBLIC_ variable, which is baked into the bundle at build
  // time — so switching the flag would need a redeploy, and the value would be
  // readable by anyone. A prop keeps it a runtime decision.
  selfDeleteEnabled: boolean;
}) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [deleteNote, setDeleteNote] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function downloadExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/privacy/export');
      if (!res.ok) {
        setError('Could not generate your export. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `charitme-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('Your data export was downloaded.');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/privacy/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'deletion', note: deleteNote || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not submit your deletion request.');
        return;
      }
      setConfirming(false);
      setDeleteNote('');
      setMessage('Your deletion request was submitted. Our team will review it.');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    setError(null);
    await fetch(`/api/privacy/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    router.refresh();
  }

  const hasOpenDeletion = initialRequests.some((r) => r.type === 'deletion' && (r.status === 'pending' || r.status === 'in_progress'));

  /**
   * Immediate, self-service deletion — App Store 5.1.1(v) requires the user to
   * initiate AND complete it in the app.
   *
   * The endpoint refuses when the account has received donations, because
   * deleting the auth user cascades through profiles -> campaigns -> donations
   * and would erase other people's financial records. That refusal is surfaced
   * verbatim rather than flattened into "something went wrong": it is permanent
   * until the campaigns are settled, so a generic error leaves the user with
   * nothing to act on.
   */
  async function deleteNow() {
    setSubmitting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: confirmPhrase }),
      });
      if (res.ok) {
        // The session is gone server-side; a full navigation avoids rendering
        // authenticated chrome for an account that no longer exists.
        window.location.href = '/?deleted=1';
        return;
      }
      const body = await res.json().catch(() => null);
      setDeleteError(body?.error ?? 'Could not delete your account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {message && (
        <div style={{ background: 'var(--green-light)', color: 'var(--green-dark)', padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 14 }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ background: 'var(--s3)', color: 'var(--red-text)', padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 14 }}>
          {error}
        </div>
      )}

      <Card>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Export your data</h2>
        <p style={{ color: 'var(--t3)', fontSize: 14, marginBottom: 14 }}>
          Download a machine-readable copy of your profile, campaigns, donations, messages,
          applications, and requests.
        </p>
        <Btn disabled={exporting} onClick={downloadExport}>
          {exporting ? 'Preparing…' : 'Download my data'}
        </Btn>
      </Card>

      <Card>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Delete your account</h2>
        <p style={{ color: 'var(--t3)', fontSize: 14, marginBottom: 14 }}>
          Request permanent deletion of your personal data. For legal reasons, records of completed
          transactions are retained but no longer linked to your identity. This cannot be undone.
        </p>
        {selfDeleteEnabled ? (
          /* Immediate deletion. The typed phrase is deliberate: a single
             confirm button is one mis-tap from an irreversible action. */
          !confirming ? (
            <Btn variant="danger" onClick={() => setConfirming(true)}>
              Delete my account
            </Btn>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                label={`Type ${DELETION_CONFIRMATION} to confirm`}
                value={confirmPhrase}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfirmPhrase(e.target.value); setDeleteError(''); }}
                placeholder={DELETION_CONFIRMATION}
                autoComplete="off"
              />
              {deleteError && (
                <p role="alert" style={{ fontSize: 13.5, color: 'var(--red-text)', margin: 0, lineHeight: 1.55 }}>
                  {deleteError}
                </p>
              )}
              <div style={{ display: 'flex', minWidth: 0, gap: 10 }}>
                <Btn
                  variant="danger"
                  disabled={submitting || !isConfirmed(confirmPhrase)}
                  onClick={() => void deleteNow()}
                >
                  {submitting ? 'Deleting…' : 'Permanently delete'}
                </Btn>
                <Btn variant="ghost" disabled={submitting} onClick={() => { setConfirming(false); setConfirmPhrase(''); setDeleteError(''); }}>
                  Cancel
                </Btn>
              </div>
            </div>
          )
        ) : hasOpenDeletion ? (
          <p style={{ fontSize: 14, color: 'var(--t2)', fontWeight: 600 }}>
            You have an open deletion request under review.
          </p>
        ) : !confirming ? (
          <Btn variant="danger" onClick={() => setConfirming(true)}>
            Request account deletion
          </Btn>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Textarea
              label="Reason (optional)"
              value={deleteNote}
              onChange={(e) => setDeleteNote(e.target.value)}
              rows={2}
              placeholder="Tell us why you're leaving (optional)…"
            />
            <div style={{ display: 'flex', minWidth: 0, gap: 10 }}>
              <Btn variant="danger" disabled={submitting} onClick={requestDeletion}>
                {submitting ? 'Submitting…' : 'Confirm deletion request'}
              </Btn>
              <Btn variant="ghost" disabled={submitting} onClick={() => setConfirming(false)}>
                Cancel
              </Btn>
            </div>
          </div>
        )}
      </Card>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Your requests</h2>
        {initialRequests.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t4)' }}>You haven’t made any privacy requests yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {initialRequests.map((r) => {
              const active = r.status === 'pending' || r.status === 'in_progress';
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', minWidth: 0,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    border: '1px solid var(--b2)',
                    borderRadius: 'var(--r)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>
                      {r.type} request <Badge color={STATUS_COLOR[r.status] ?? 'gray'}>{r.status.replace('_', ' ')}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 2 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                      {r.resolution_note ? ` · ${r.resolution_note}` : ''}
                    </div>
                  </div>
                  {active && (
                    <Btn size="sm" variant="ghost" onClick={() => cancel(r.id)}>
                      Cancel
                    </Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
