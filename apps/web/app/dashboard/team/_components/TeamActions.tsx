'use client';

import React, { useState } from 'react';

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
        <span style={{ fontSize: 11, color: 'var(--red, #c0003c)', marginRight: 8 }}>{error}</span>
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
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ width: 460, background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(20,20,80,.18)', overflow: 'hidden' }}>
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f0f30' }}>Invite Team Member</div>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5' }}>×</button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gap: 16 }}>
              {error && <div style={{ padding: '10px 14px', background: 'rgba(190,18,60,.08)', borderRadius: 9, color: 'var(--red, #c0003c)', fontSize: 13, fontWeight: 700 }}>{error}</div>}
              {success && <div style={{ padding: '10px 14px', background: 'rgba(25,184,106,.08)', borderRadius: 9, color: 'var(--green-dark, #15803d)', fontSize: 13, fontWeight: 700 }}>{success}</div>}

              {campaigns.length > 1 && (
                <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                  Campaign
                  <select value={campaignId} onChange={e => setCampaignId(e.target.value)} style={{ height: 44, border: '1px solid var(--b2, #dfe3ee)', borderRadius: 9, padding: '0 14px', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
              )}

              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  style={{ height: 44, border: '1px solid var(--b2, #dfe3ee)', borderRadius: 9, padding: '0 14px', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}
                />
                <span style={{ fontSize: 11, color: 'var(--t3, #8c9ab5)', fontWeight: 400 }}>The user must already have a CharitMe account.</span>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Role
                <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'member' | 'viewer')} style={{ height: 44, border: '1px solid var(--b2, #dfe3ee)', borderRadius: 9, padding: '0 14px', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}>
                  <option value="admin">Admin — can edit and manage campaign</option>
                  <option value="member">Member — can post updates</option>
                  <option value="viewer">Viewer — read-only access</option>
                </select>
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0f7', display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, height: 44, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleInvite} disabled={saving} style={{ flex: 1, height: 44, border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
