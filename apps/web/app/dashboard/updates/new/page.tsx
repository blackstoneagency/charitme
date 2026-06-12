'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeApp';
import { createClient } from '../../../../lib/supabase-browser'; // used for auth check + campaign list

type Campaign = { id: string; title: string };

export default function NewUpdatePage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  useEffect(() => {

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      supabase
        .from('campaigns')
        .select('id, title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          const list = (data ?? []) as Campaign[];
          setCampaigns(list);
          if (list.length > 0) setCampaignId(list[0].id);
          setLoadingCampaigns(false);
        });
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignId) { setError('Please select a campaign.'); return; }
    if (!body.trim()) { setError('Update body is required.'); return; }
    setSaving(true);
    setError('');
    try {
      // Use the updates API which saves AND emails donors
      const res = await fetch(`/api/campaigns/${campaignId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          body: body.trim(),
          notifyDonors: !scheduleMode, // don't email until actually published
          scheduledAt: scheduleMode && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to post update.'); return; }
      router.push('/dashboard/updates');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <CharitMeShell active="Updates">
      <TopBar
        title="Post Update"
        subtitle="Share progress, milestones, and stories with your supporters."
        actions={
          <button
            type="button"
            onClick={() => router.back()}
            className="kf-outline"
            style={{ height: 40 }}
          >
            Cancel
          </button>
        }
      />
      <div style={{ padding: '0 32px 40px', maxWidth: 680 }}>
        <form onSubmit={handleSubmit}>
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#e7f8ed,#19b86a)', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width={20} height={20} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div><h2>Campaign Update</h2><p>Keep your donors informed about progress.</p></div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              {error && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fff0f3', border: '1px solid #ffc0cb', borderRadius: 10, color: '#c0003c', fontSize: 14, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              {loadingCampaigns ? (
                <div style={{ color: 'var(--t3)', fontSize: 14, padding: 12 }}>Loading campaigns…</div>
              ) : campaigns.length === 0 ? (
                <div style={{ color: 'var(--t3)', fontSize: 14, padding: 12 }}>
                  You have no campaigns yet.{' '}
                  <a href="/create" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>Create one →</a>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                    Campaign *
                    <select
                      value={campaignId}
                      onChange={e => setCampaignId(e.target.value)}
                      required
                      style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}
                    >
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                    Title <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(optional)</span>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      maxLength={120}
                      placeholder="e.g. Surgery was a success! Thank you all"
                      style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                    Update *
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      required
                      rows={8}
                      maxLength={5000}
                      placeholder="Share what's happening, how funds are being used, and a heartfelt thank-you to your donors…"
                      style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '12px 14px', fontSize: 14, resize: 'vertical', minHeight: 180, lineHeight: 1.6 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'right' }}>{body.length}/5000</span>
                  </label>

                  {/* Schedule option */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <input type="checkbox" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} style={{ width: 16, height: 16 }} />
                      Schedule for later
                    </label>
                    {scheduleMode && (
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={e => setScheduledAt(e.target.value)}
                        required={scheduleMode}
                        style={{ height: 38, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 10px', fontSize: 13 }}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                    <button
                      type="submit"
                      disabled={saving || !body.trim() || (scheduleMode && !scheduledAt)}
                      style={{
                        height: 48, padding: '0 32px', border: 0, borderRadius: 11,
                        background: saving || !body.trim() ? '#c0b8e8' : 'linear-gradient(135deg,#6c35ff,#551cf2)',
                        color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'wait' : 'pointer',
                      }}
                    >
                      {saving ? (scheduleMode ? 'Scheduling…' : 'Posting…') : (scheduleMode ? 'Schedule Update' : 'Post Update')}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.back()}
                      style={{ height: 48, padding: '0 24px', border: '1px solid #dfe3ee', borderRadius: 11, background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </CharitMeShell>
  );
}
