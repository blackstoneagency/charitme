'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Donation = {
  id: string;
  amount_cents: number;
  created_at: string;
  anonymous: boolean;
  donor_id: string | null;
  donor_name: string;
};

type Campaign = { id: string; title: string; slug: string };

const TEMPLATES = [
  {
    label: 'Heartfelt thanks',
    text: `Your generosity means more than words can express. Because of your support, we're one step closer to our goal and to the change we're working to create. I'm deeply grateful that you chose to give, and I promise to keep you updated as your donation makes a difference. Thank you for believing in this campaign.`,
  },
  {
    label: 'Progress update',
    text: `We've hit an incredible milestone thanks to donors like you! Your donation is part of a growing wave of support that's making a real impact. I wanted to take a moment to personally thank you and share that because of your generosity, we're making meaningful progress. Stay tuned for updates.`,
  },
  {
    label: 'Impact-focused',
    text: `Because of your donation, something real is happening. Your contribution is directly funding the work we set out to do. I believe that giving is one of the most powerful acts of human connection, and today you demonstrated that. Thank you from the bottom of my heart.`,
  },
];

export default function ThankDonorsPanel({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(TEMPLATES[0]!.text);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/thank`).catch(() => null);
      if (!active) return;
      if (!res || res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { setError('Could not load donors.'); setLoading(false); return; }
      const d = await res.json() as { campaign: Campaign; donations: Donation[] };
      if (!active) return;
      setCampaign(d.campaign);
      setDonations(d.donations);
      // Select all by default
      setSelected(new Set(d.donations.map(x => x.id)));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [campaignId, router]);

  async function handleSend() {
    if (!campaign || selected.size === 0 || message.trim().length < 10) return;
    setSending(true);
    setError('');

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/thank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          donationIds: [...selected],
        }),
      });
      const data = await res.json() as { ok?: boolean; sent?: number; failed?: number; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to send thank-you emails.'); return; }
      setSuccess({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const fmtCents = (c: number) => `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) {
    return <div style={{ padding: '24px 0', color: 'var(--t3)', fontSize: 14 }}>Loading…</div>;
  }

  if (success) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ background: 'rgba(18,166,83,.12)', border: '1.5px solid rgba(18,166,83,.28)', borderRadius: 14, padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💌</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--green-dark)' }}>Thank-you emails sent!</h2>
          <p style={{ fontSize: 14, color: 'var(--green-dark)', margin: '0 0 8px' }}><strong>{success.sent}</strong> email{success.sent !== 1 ? 's' : ''} sent successfully.</p>
          {success.failed > 0 && <p style={{ fontSize: 13, color: '#c2410c', margin: '0 0 20px' }}>{success.failed} could not be delivered (missing email).</p>}
          <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', marginTop: 20 }}>
            <button onClick={() => setSuccess(null)} style={{ padding: '10px 24px', border: '1px solid var(--b2)', borderRadius: 10, background: 'var(--s1)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Send Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 760 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>Thank Your Donors</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--t3)' }}>
          {campaign ? `Send personalised thank-you emails to ${campaign.title} donors.` : 'Thank your supporters.'}
        </p>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'rgba(255,59,95,.08)', border: '1px solid rgba(255,59,95,.28)', borderRadius: 10, color: 'var(--red)', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

      {donations.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--s2)', borderRadius: 14, border: '1px solid var(--b2)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
          <p style={{ fontWeight: 700, margin: '0 0 8px' }}>No donors to thank yet.</p>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>Donors without email addresses or anonymous donors cannot receive thank-you emails.</p>
        </div>
      ) : (
        <>
          {/* Template picker */}
          <section className="kf-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 650, margin: '0 0 14px' }}>Message</h2>
            <div style={{ display: 'flex', minWidth: 0, gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {TEMPLATES.map(t => (
                <button key={t.label} type="button" onClick={() => setMessage(t.text)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--b2)', background: message === t.text ? 'rgba(109,53,255,.14)' : 'var(--s1)', color: message === t.text ? 'var(--violet)' : 'var(--t2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea aria-label="Thank-you message to donors" value={message} onChange={e => setMessage(e.target.value)} rows={6} maxLength={2000}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--b2)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6 }} />
            <p style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'right', margin: '4px 0 0' }}>{message.length}/2000</p>
          </section>

          {/* Donor selection */}
          <section className="kf-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0 }}>Recipients ({selected.size} of {donations.length})</h2>
              <div style={{ display: 'flex', minWidth: 0, gap: 8 }}>
                <button type="button" onClick={() => setSelected(new Set(donations.map(d => d.id)))} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-text)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Select all</button>
                <button type="button" onClick={() => setSelected(new Set())} style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Clear</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {donations.map(d => (
                <label key={d.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${selected.has(d.id) ? 'var(--green)' : 'var(--b2)'}`, borderRadius: 10, cursor: 'pointer', background: selected.has(d.id) ? 'rgba(18,166,83,.12)' : 'var(--s1)', transition: 'border-color .1s' }}>
                  <input type="checkbox" checked={selected.has(d.id)} onChange={e => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(d.id); else next.delete(d.id);
                    setSelected(next);
                  }} style={{ width: 16, height: 16, accentColor: 'var(--green)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.donor_name}</strong>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', flexShrink: 0 }}>{fmtCents(d.amount_cents)}</span>
                  <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>{fmtDate(d.created_at)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Send */}
          <div style={{ display: 'flex', minWidth: 0, gap: 12 }}>
            <button type="button" onClick={() => void handleSend()} disabled={sending || selected.size === 0 || message.trim().length < 10}
              style={{ height: 48, padding: '0 32px', border: 0, borderRadius: 10, background: sending || selected.size === 0 ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 650, fontSize: 14, cursor: sending || selected.size === 0 ? 'not-allowed' : 'pointer' }}>
              {sending ? 'Sending…' : `Send to ${selected.size} donor${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
