'use client';

import React, { useState, useEffect } from 'react';

// ─────────────────────────────────────────────
// Remove button — deletes a single team member
// ─────────────────────────────────────────────
export function RemoveMemberButton({
  memberId,
  memberName,
  onRemoved,
}: {
  memberId: string;
  memberName: string;
  onRemoved: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function handleRemove() {
    if (!confirm(`Remove ${memberName} from this campaign?`)) return;
    setRemoving(true);
    setError('');
    try {
      const res = await fetch(`/api/team-members/${memberId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'Failed to remove member.');
        return;
      }
      onRemoved(memberId);
    } catch {
      setError('Something went wrong.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--red, var(--red))', marginRight: 8 }}>{error}</span>
      )}
      <button
        type="button"
        disabled={removing}
        onClick={handleRemove}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: removing ? 'var(--t3)' : 'var(--t3)',
          background: 'none',
          border: '1px solid var(--b2)',
          borderRadius: 'var(--r)',
          padding: '4px 10px',
          cursor: removing ? 'wait' : 'pointer',
          opacity: removing ? 0.6 : 1,
        }}
      >
        {removing ? 'Removing…' : 'Remove'}
      </button>
    </>
  );
}

// ─────────────────────────────────────────────
// Invite modal
// ─────────────────────────────────────────────
interface Campaign { id: string; title: string }
export interface NewMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export function InviteMemberButton({ campaigns, onAdded }: { campaigns: Campaign[]; onAdded: (m: NewMember) => void }) {
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Escape closes the invite modal (keyboard-accessible dismiss).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleInvite() {
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!campaignId) { setError('Please select a campaign.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; member?: NewMember };
      if (!res.ok) { setError(data.error ?? 'Failed to add member.'); return; }
      setSuccess(`${email} added successfully!`);
      setEmail('');
      if (data.member) onAdded(data.member);
      setTimeout(() => { setSuccess(''); setOpen(false); }, 2000);
    } catch {
      setError('Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="kf-primary"
        onClick={() => { setOpen(true); setError(''); setSuccess(''); }}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        + Invite Member
      </button>

      {open && (
        // Backdrop dismissal is supplementary; Escape and the close button remain available.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="kf-modal-responsive" style={{ width: 460, background: 'var(--s1)', borderRadius: 16, boxShadow: '0 20px 60px rgba(20,20,80,.18)', overflow: 'hidden' }}>
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>Invite Team Member</div>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 32, height: 32, border: '1px solid var(--b1)', borderRadius: '50%', background: 'var(--s1)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t3)' }}>×</button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
              {error && <div style={{ padding: '10px 14px', background: 'rgba(190,18,60,.08)', borderRadius: 9, color: 'var(--red, var(--red))', fontSize: 13, fontWeight: 700 }}>{error}</div>}
              {success && <div style={{ padding: '10px 14px', background: 'rgba(25,184,106,.08)', borderRadius: 9, color: 'var(--green-dark, var(--green-dark))', fontSize: 13, fontWeight: 700 }}>{success}</div>}

              {campaigns.length > 1 && (
                <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                  Campaign
                  <select value={campaignId} onChange={e => setCampaignId(e.target.value)} style={{ height: 44, border: '1px solid var(--b2, var(--b1))', borderRadius: 9, padding: '0 14px', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
              )}

              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  style={{ height: 44, border: '1px solid var(--b2, var(--b1))', borderRadius: 9, padding: '0 14px', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}
                />
                <span style={{ fontSize: 11, color: 'var(--t3, var(--t3))', fontWeight: 400 }}>The user must already have a CharitMe account.</span>
              </label>

              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                Role
                <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'member' | 'viewer')} style={{ height: 44, border: '1px solid var(--b2, var(--b1))', borderRadius: 9, padding: '0 14px', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400 }}>
                  Saved for when per-role permissions ship. Today every team member gets
                  the same access — they can view this campaign&rsquo;s analytics, and
                  cannot edit it or post updates. Only the campaign owner can do that.
                </span>
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, height: 44, border: '1px solid var(--b1)', borderRadius: 9, background: 'var(--s1)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleInvite} disabled={saving} style={{ flex: 1, height: 44, border: 0, borderRadius: 9, background: 'var(--violet)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
