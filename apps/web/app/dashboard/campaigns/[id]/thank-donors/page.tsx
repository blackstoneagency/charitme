'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../../components/CharitMeApp';
import { createClient } from '../../../../../lib/supabase-browser';
import { formatMoneyShort } from '@shared/currencies';

type Donation = {
  id: string;
  amount_cents: number;
  currency: string | null;
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

export default function ThankDonorsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(TEMPLATES[0]!.text);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id }) => setCampaignId(id));
  }, [params]);

  useEffect(() => {
    if (!campaignId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }

      Promise.all([
        supabase.from('campaigns').select('id, title, slug').eq('id', campaignId).eq('user_id', user.id).single(),
        supabase.from('donations').select('id, amount_cents, currency, created_at, anonymous, donor_id').eq('campaign_id', campaignId).eq('status', 'completed').eq('anonymous', false).order('created_at', { ascending: false }).limit(200),
      ]).then(([{ data: camp }, { data: dons }]) => {
        if (!camp) { router.push('/dashboard/campaigns'); return; }
        setCampaign(camp as Campaign);

        const donList = (dons ?? []) as { id: string; amount_cents: number; currency: string | null; created_at: string; anonymous: boolean; donor_id: string | null }[];
        const uniqueDonorIds = [...new Set(donList.map(d => d.donor_id).filter(Boolean))] as string[];

        if (uniqueDonorIds.length === 0) {
          setDonations([]);
          setLoading(false);
          return;
        }

        supabase.from('profiles').select('id, full_name').in('id', uniqueDonorIds).then(({ data: profiles }) => {
          const profileMap = new Map<string, string>(
            ((profiles ?? []) as { id: string; full_name: string | null }[]).map(p => [p.id, p.full_name ?? 'Donor'])
          );
          const enriched: Donation[] = donList.map(d => ({
            ...d,
            donor_name: d.donor_id ? (profileMap.get(d.donor_id) ?? 'Donor') : 'Donor',
          }));
          setDonations(enriched);
          // Select all by default
          setSelected(new Set(enriched.map(d => d.id)));
          setLoading(false);
        });
      });
    });
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

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <CharitMeShell active="My Campaigns">
        <TopBar title="Thank Donors" subtitle="Loading…" />
        <div style={{ padding: 32, color: 'var(--t3)' }}>Loading…</div>
      </CharitMeShell>
    );
  }

  if (success) {
    return (
      <CharitMeShell active="My Campaigns">
        <TopBar title="Thank Donors" subtitle="Thank-you emails sent!" />
        <div className="kf-admin-dash" style={{ maxWidth: 560 }}>
          <div style={{ background: '#f0fff8', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💌</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: '#064e3b' }}>Thank-you emails sent!</h2>
            <p style={{ fontSize: 14, color: '#065f46', margin: '0 0 8px' }}><strong>{success.sent}</strong> email{success.sent !== 1 ? 's' : ''} sent successfully.</p>
            {success.failed > 0 && <p style={{ fontSize: 13, color: '#c2410c', margin: '0 0 20px' }}>{success.failed} could not be delivered (missing email).</p>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
              <Link href={`/dashboard/campaigns/${campaignId}`} style={{ padding: '10px 24px', background: '#19b86a', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Back to Campaign</Link>
              <button onClick={() => setSuccess(null)} style={{ padding: '10px 24px', border: '1px solid var(--b2)', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Send Another</button>
            </div>
          </div>
        </div>
      </CharitMeShell>
    );
  }

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Thank Your Donors"
        subtitle={campaign ? `Send personalised thank-you emails to ${campaign.title} donors.` : 'Thank your supporters.'}
        actions={<Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>}
      />

      <div className="kf-admin-dash" style={{ maxWidth: 760 }}>
        {error && <div style={{ padding: '12px 16px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 10, color: '#be123c', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

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
              <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 14px' }}>Message</h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {TEMPLATES.map(t => (
                  <button key={t.label} type="button" onClick={() => setMessage(t.text)}
                    style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--b2)', background: message === t.text ? '#f0eaff' : '#fff', color: message === t.text ? '#551cf2' : 'var(--t2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} maxLength={2000}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--b2)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6 }} />
              <p style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'right', margin: '4px 0 0' }}>{message.length}/2000</p>
            </section>

            {/* Donor selection */}
            <section className="kf-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Recipients ({selected.size} of {donations.length})</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setSelected(new Set(donations.map(d => d.id)))} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Select all</button>
                  <button type="button" onClick={() => setSelected(new Set())} style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Clear</button>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {donations.map(d => (
                  <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${selected.has(d.id) ? 'var(--green)' : 'var(--b2)'}`, borderRadius: 10, cursor: 'pointer', background: selected.has(d.id) ? '#f0fff8' : '#fff', transition: 'border-color .1s' }}>
                    <input type="checkbox" checked={selected.has(d.id)} onChange={e => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(d.id); else next.delete(d.id);
                      setSelected(next);
                    }} style={{ width: 16, height: 16, accentColor: 'var(--green)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.donor_name}</strong>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>{formatMoneyShort(d.amount_cents, d.currency ?? 'usd')}</span>
                    <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>{fmtDate(d.created_at)}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Send */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => void handleSend()} disabled={sending || selected.size === 0 || message.trim().length < 10}
                style={{ height: 48, padding: '0 32px', border: 0, borderRadius: 10, background: sending || selected.size === 0 ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: sending || selected.size === 0 ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Sending…' : `Send to ${selected.size} donor${selected.size !== 1 ? 's' : ''}`}
              </button>
              <Link href={`/dashboard/campaigns/${campaignId}`} style={{ height: 48, padding: '0 24px', border: '1px solid var(--b2)', borderRadius: 10, background: '#fff', color: 'var(--t1)', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Cancel</Link>
            </div>
          </>
        )}
      </div>
    </CharitMeShell>
  );
}
