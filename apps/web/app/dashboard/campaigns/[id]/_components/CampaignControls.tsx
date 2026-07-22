'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'draft' | 'active' | 'paused' | 'completed' | 'frozen' | 'archived';

const STATUS_ACTIONS: Record<Status, { label: string; next: Status; color: string; confirm?: string }[]> = {
  draft:     [{ label: 'Publish Campaign', next: 'active', color: '#19b86a' }],
  active:    [
    { label: 'Pause Donations', next: 'paused', color: '#f59e0b', confirm: 'Pausing stops new donations but keeps the page live. Continue?' },
    { label: 'Close Campaign',  next: 'completed', color: '#64748b', confirm: 'Closing marks the campaign as completed. Donors will see it as ended. Continue?' },
  ],
  paused:    [
    { label: 'Resume Donations', next: 'active', color: '#19b86a' },
    { label: 'Close Campaign',   next: 'completed', color: '#64748b', confirm: 'Close this campaign permanently?' },
  ],
  completed: [{ label: 'Archive Campaign', next: 'archived', color: '#64748b', confirm: 'Archived campaigns are hidden from search. You can still view them in your dashboard.' }],
  frozen:    [],
  archived:  [],
};

const STATUS_BADGE: Record<Status, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#f1f5f9', color: '#64748b',  label: 'Draft'     },
  active:    { bg: '#f0fff8', color: '#065f46',  label: 'Active'    },
  paused:    { bg: '#fffbeb', color: '#92400e',  label: 'Paused'    },
  completed: { bg: '#e0f2fe', color: '#0369a1',  label: 'Completed' },
  frozen:    { bg: '#fff0f3', color: '#be123c',  label: 'Frozen'    },
  archived:  { bg: '#f1f5f9', color: '#475569',  label: 'Archived'  },
};

export default function CampaignControls({
  campaignId,
  currentStatus,
}: {
  campaignId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const status = currentStatus as Status;
  const badge  = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  const actions = STATUS_ACTIONS[status] ?? [];

  async function changeStatus(next: Status, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed.'); return; }
      router.refresh();
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function deleteCampaign() {
    if (!window.confirm('Permanently delete this campaign? This cannot be undone.')) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to delete.'); return; }
      router.push('/dashboard/campaigns');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  return (
    <section className="kf-card" style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 650 }}>Campaign Status</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: error ? 12 : 16, flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 650, ...badge }}>
          {badge.label}
        </span>
        <span style={{ fontSize: 13, color: 'var(--t3)' }}>
          {status === 'active'    && 'Your campaign is live and accepting donations.'}
          {status === 'paused'    && 'Donations are paused. The public page is unavailable until you resume the campaign.'}
          {status === 'draft'     && 'Not yet published. Publish to start accepting donations.'}
          {status === 'completed' && 'Campaign is closed. No new donations accepted.'}
          {status === 'frozen'    && 'Campaign frozen by admin. Contact support.'}
          {status === 'archived'  && 'Campaign archived. Not visible in search.'}
        </span>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 9, color: '#be123c', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {actions.map(action => (
          <button
            key={action.next}
            type="button"
            disabled={loading || status === 'frozen'}
            onClick={() => void changeStatus(action.next, action.confirm)}
            style={{
              height: 38, padding: '0 18px', border: 0, borderRadius: 9,
              background: action.color, color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '…' : action.label}
          </button>
        ))}

        {/* Delete — only for draft/archived/completed */}
        {['draft', 'archived', 'completed'].includes(status) && (
          <button
            type="button"
            disabled={loading}
            onClick={() => setShowDelete(true)}
            style={{ height: 38, padding: '0 18px', border: '1px solid #fca5a5', borderRadius: 9, background: '#fff0f3', color: '#be123c', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Delete Campaign
          </button>
        )}
      </div>

      {showDelete && (
        <div style={{ marginTop: 16, padding: '16px 18px', background: '#fff0f3', border: '1.5px solid #fca5a5', borderRadius: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#be123c', margin: '0 0 12px' }}>
            ⚠ Delete this campaign? This cannot be undone.
          </p>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px', lineHeight: 1.6 }}>
            All campaign data, updates, and media will be permanently removed. Donation records are retained for compliance.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => void deleteCampaign()} disabled={loading}
              style={{ padding: '8px 20px', border: 0, borderRadius: 8, background: '#be123c', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Deleting…' : 'Yes, permanently delete'}
            </button>
            <button type="button" onClick={() => setShowDelete(false)}
              style={{ padding: '8px 20px', border: '1px solid var(--b2)', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'frozen' && (
        <p style={{ fontSize: 13, color: '#be123c', margin: '12px 0 0' }}>
          This campaign has been frozen by our trust & safety team.{' '}
          <a href="/contact" style={{ color: '#6c35ff', fontWeight: 700 }}>Contact support</a> to appeal.
        </p>
      )}
    </section>
  );
}
