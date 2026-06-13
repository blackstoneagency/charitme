'use client';

import React, { useEffect, useState } from 'react';

type Update = {
  id: string;
  title: string | null;
  body: string;
  ai_generated: boolean;
  created_at: string;
  published_at: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function UpdatesPanel({ campaignId }: { campaignId: string }) {
  const [updates, setUpdates]       = useState<Update[]>([]);
  const [loading, setLoading]       = useState(true);

  // New update form
  const [title, setTitle]             = useState('');
  const [body, setBody]               = useState('');
  const [notifyDonors, setNotifyDonors] = useState(true);
  const [saveState, setSaveState]     = useState<SaveState>('idle');
  const [formError, setFormError]     = useState('');

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      try {
        const r = await fetch(`/api/campaigns/${campaignId}/updates`);
        const d = r.ok ? await r.json() : { updates: [] };
        if (active) setUpdates(d.updates ?? []);
      } catch { /* non-fatal */ } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [campaignId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 10) { setFormError('Update must be at least 10 characters.'); return; }
    setSaveState('saving');
    setFormError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, body: body.trim(), notifyDonors }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? 'Failed to post update');
        setSaveState('error');
        return;
      }
      const d = await res.json();
      setUpdates(prev => [d.update, ...prev]);
      setTitle('');
      setBody('');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setFormError('Network error');
      setSaveState('error');
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Campaign Updates</h2>
        <p style={{ fontSize: 14, color: '#64748b', margin: '6px 0 0' }}>
          Post progress updates to your donors. They&apos;ll receive an email notification if opted in.
        </p>
      </div>

      {/* New update form */}
      <form onSubmit={handlePost} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, padding: '24px 28px', marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 650, color: '#1a1a2e' }}>Post a new update</h2>

        {formError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#dc2626', fontSize: 13 }}>
            {formError}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#334064', marginBottom: 6 }}>
            Title <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. We hit 50% of our goal!"
            maxLength={200}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e8ecf4', fontSize: 14, color: '#334064', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#334064', marginBottom: 6 }}>
            Update <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Share your progress, milestones, or a thank-you message…"
            rows={6}
            maxLength={10000}
            required
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e8ecf4', fontSize: 14, color: '#334064', boxSizing: 'border-box', resize: 'vertical' }}
          />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>{body.length}/10000</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={notifyDonors}
              onChange={e => setNotifyDonors(e.target.checked)}
              style={{ accentColor: '#6c35ff' }}
            />
            <span style={{ fontWeight: 600, color: '#334064' }}>Email donors about this update</span>
          </label>
          <button
            type="submit"
            disabled={saveState === 'saving'}
            style={{
              background: saveState === 'saved' ? '#19b86a' : '#6c35ff',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 28px', fontWeight: 650, fontSize: 14,
              cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
              opacity: saveState === 'saving' ? 0.7 : 1,
            }}
          >
            {saveState === 'saving' ? 'Posting…' : saveState === 'saved' ? 'Posted!' : 'Post update'}
          </button>
        </div>
      </form>

      {/* Existing updates */}
      <h2 style={{ fontSize: 16, fontWeight: 650, color: '#1a1a2e', marginBottom: 14 }}>
        Past updates {updates.length > 0 && <span style={{ fontWeight: 500, color: '#94a3b8' }}>({updates.length})</span>}
      </h2>

      {loading && <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</div>}

      {!loading && updates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 14 }}>
          No updates yet. Post your first one above!
        </div>
      )}

      {!loading && updates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {updates.map(u => (
            <div key={u.id} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '18px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  {u.title && <div style={{ fontWeight: 650, fontSize: 15, color: '#1a1a2e', marginBottom: 2 }}>{u.title}</div>}
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(u.created_at)}</div>
                </div>
                {u.ai_generated && (
                  <span style={{ fontSize: 10, background: '#f5f0ff', color: '#6c35ff', fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>AI</span>
                )}
              </div>
              <p style={{ fontSize: 14, color: '#334064', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {u.body.length > 300 ? u.body.slice(0, 300) + '…' : u.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
