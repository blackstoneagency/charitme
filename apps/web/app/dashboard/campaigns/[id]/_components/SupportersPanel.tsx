'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RecordOfflineDonation from './RecordOfflineDonation';

/* ── types mirroring /api/campaigns/[id]/supporters ── */
interface SupporterRow {
  key: string; name: string; emailMasked: string | null; reachable: boolean;
  giftCount: number; totalCents: number; lastGiftAt: string; isRepeat: boolean; isLapsed: boolean;
}
interface TemplateDef { key: string; label: string; description: string; defaultTarget: string; subject: string; body: string }
interface TargetDef { key: string; label: string; description: string }
interface SendRecord { id: string; template_key: string; target_group: string; subject: string; recipient_count: number; sent_count: number; suppressed_count: number; status: string; created_at: string }
interface SupportersData {
  campaign: { id: string; title: string; slug: string };
  stats: { supporters: number; emailable: number; repeat: number; lapsed: number; totalCents: number };
  targetCounts: Record<string, number>;
  supporters: SupporterRow[];
  attribution: { channel: string; clicks: number; conversions: number }[];
  templates: TemplateDef[];
  targetGroups: TargetDef[];
  sendsRemainingToday: number;
  history: SendRecord[];
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const dt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 14, padding: '20px 24px', marginBottom: 16 };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--b2)' };
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, color: 'var(--t2)', borderBottom: '1px solid var(--b1)' };

export default function SupportersPanel({
  campaignId,
  showHeading = false,
}: {
  campaignId: string;
  showHeading?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<SupportersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Send panel state
  const [templateKey, setTemplateKey] = useState('thank_recent');
  const [targetGroup, setTargetGroup] = useState('recent_donors');
  const [bodyDraft, setBodyDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}/supporters`);
    if (res.status === 401) { router.push('/login'); return; }
    if (!res.ok) { setError('Could not load supporters.'); setLoading(false); return; }
    const d = await res.json() as SupportersData;
    setData(d);
    const t = d.templates[0];
    if (t) { setTemplateKey(t.key); setTargetGroup(t.defaultTarget); setBodyDraft(t.body); }
    setLoading(false);
  }, [router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { if (campaignId) void load(campaignId); }, [campaignId, load]);

  const pickTemplate = (key: string) => {
    const t = data?.templates.find(x => x.key === key);
    if (!t) return;
    setTemplateKey(key);
    setTargetGroup(t.defaultTarget);
    setBodyDraft(t.body);
  };

  const send = async () => {
    if (!data) return;
    const count = data.targetCounts[targetGroup] ?? 0;
    if (!confirm(`Send this email to ${count} supporter${count === 1 ? '' : 's'}?`)) return;
    setSending(true);
    setNotice('');
    const res = await fetch(`/api/campaigns/${campaignId}/engage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateKey, targetGroup, customBody: bodyDraft }),
    });
    const d = await res.json() as { sent?: number; suppressed?: number; error?: string; detail?: string };
    if (!res.ok) setNotice(`❌ ${d.error}`);
    else setNotice(d.detail ? `⚠ ${d.detail}` : `✓ Sent to ${d.sent} supporters${d.suppressed ? ` (${d.suppressed} skipped — unsubscribed or unreachable)` : ''}`);
    setSending(false);
    void load(campaignId);
  };

  if (loading) {
    return <div style={{ padding: '24px 0', color: 'var(--t3)', fontSize: 14 }}>Loading supporters…</div>;
  }
  if (error || !data) {
    return (
      <div style={{ padding: '24px 0', color: 'var(--red)', fontSize: 14 }}>
        {error || 'Not found.'} <Link href="/dashboard/campaigns">← Back to campaigns</Link>
      </div>
    );
  }

  const selectedTemplate = data.templates.find(t => t.key === templateKey);

  return (
    <div style={{ maxWidth: 1080 }}>
      {/* /api/offline-donations was fully built and had no caller anywhere, so cash
          and cheques could not be entered at all. This is that missing surface. */}
      <RecordOfflineDonation campaignId={campaignId} />
      {showHeading && (
        <>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>My Supporters</h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--t3)' }}>
            {data.campaign.title} — know your donors, bring them back.
          </p>
        </>
      )}
      <Link href="/dashboard/campaigns" style={{ fontSize: 13, color: 'var(--t3)', textDecoration: 'none' }}>← Back to campaigns</Link>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '16px 0 20px' }}>
        {[
          ['Supporters', String(data.stats.supporters)],
          ['Total raised from them', money(data.stats.totalCents)],
          ['Repeat donors', String(data.stats.repeat)],
          ['Lapsed (30d+)', String(data.stats.lapsed)],
          ['Sends left today', String(data.sendsRemainingToday)],
        ].map(([label, value]) => (
          <div key={label} style={{ ...card, marginBottom: 0, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 650, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      {notice && (
        <div style={{ ...card, padding: '12px 18px', fontWeight: 700, fontSize: 13, color: notice.startsWith('❌') ? 'var(--red)' : notice.startsWith('⚠') ? '#d97706' : 'var(--green)' }}>
          {notice}
        </div>
      )}

      {/* ── Re-engagement sender ── */}
      <div style={card}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Re-engage your supporters</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--t3)' }}>
          Pick a template, personalize it, send. CharitMe delivers the email, honors unsubscribes automatically, and never shares donor email addresses with you.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {data.templates.map(t => (
            <button key={t.key} onClick={() => pickTemplate(t.key)}
              style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 650, cursor: 'pointer',
                border: `1.5px solid ${templateKey === t.key ? 'var(--violet)' : 'var(--b2)'}`,
                background: templateKey === t.key ? 'rgba(108,53,255,.08)' : 'var(--s1)',
                color: templateKey === t.key ? 'var(--violet)' : 'var(--t2)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {selectedTemplate && (
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--t3)' }}>{selectedTemplate.description}</p>
        )}

        <span id="sp-sendto-label" style={{ display: 'block', fontSize: 12, fontWeight: 650, color: 'var(--t2)', marginBottom: 6 }}>Send to</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }} role="group" aria-labelledby="sp-sendto-label">
          {data.targetGroups.map(g => (
            <button key={g.key} onClick={() => setTargetGroup(g.key)} title={g.description}
              style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${targetGroup === g.key ? 'var(--violet)' : 'var(--b2)'}`,
                background: targetGroup === g.key ? 'rgba(108,53,255,.08)' : 'var(--s1)',
                color: targetGroup === g.key ? 'var(--violet)' : 'var(--t2)' }}>
              {g.label} · {data.targetCounts[g.key] ?? 0}
            </button>
          ))}
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 650, color: 'var(--t2)', marginBottom: 6 }}>
          Message — {'{{first_name}}'} personalizes per donor
        </label>
        <textarea
          aria-label="Message to supporters"
          value={bodyDraft}
          onChange={e => setBodyDraft(e.target.value)}
          rows={9}
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--b2)', borderRadius: 10, fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit', background: 'var(--s1)', color: 'var(--t1)', resize: 'vertical', marginBottom: 12 }}
        />

        <button
          onClick={() => void send()}
          disabled={sending || data.sendsRemainingToday <= 0 || (data.targetCounts[targetGroup] ?? 0) === 0}
          style={{ padding: '12px 26px', background: data.sendsRemainingToday <= 0 ? 'var(--b2)' : 'var(--violet)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: data.sendsRemainingToday <= 0 ? 'not-allowed' : 'pointer' }}>
          {sending ? 'Sending…'
            : data.sendsRemainingToday <= 0 ? 'Daily limit reached (2/day)'
            : `Send to ${data.targetCounts[targetGroup] ?? 0} supporters →`}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Supporters table ── */}
        <div style={{ ...card, padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Supporter</th><th style={th}>Gifts</th><th style={th}>Total</th><th style={th}>Last gift</th><th style={th}>Status</th>
            </tr></thead>
            <tbody>
              {data.supporters.length === 0 && <tr><td style={td} colSpan={5}>No completed donations yet — share your campaign to get your first supporters.</td></tr>}
              {data.supporters.map(s => (
                <tr key={s.key}>
                  <td style={td}>
                    <div style={{ fontWeight: 650, color: 'var(--t1)' }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--t4)', fontFamily: 'var(--mono)' }}>{s.emailMasked ?? 'no email on file'}</div>
                  </td>
                  <td style={td}>{s.giftCount}{s.isRepeat && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--green-text)', background: 'rgba(5,150,105,.1)', padding: '2px 7px', borderRadius: 999 }}>REPEAT</span>}</td>
                  <td style={td}><b style={{ color: 'var(--t1)' }}>{money(s.totalCents)}</b></td>
                  <td style={td}>{dt(s.lastGiftAt)}</td>
                  <td style={td}>
                    {!s.reachable ? <span style={{ fontSize: 11, color: 'var(--t4)' }}>unreachable</span>
                      : s.isLapsed ? <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--orange-text)' }}>lapsed</span>
                      : <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--green-text)' }}>active</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {/* ── Attribution ── */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Where donations come from</h3>
            {data.attribution.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--t3)' }}>No share-link data yet. Use the Share page to create tracked links — results show here.</p>}
            {data.attribution.map(a => (
              <div key={a.channel} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--b1)', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: 'var(--t2)', textTransform: 'capitalize' }}>{a.channel}</span>
                <span style={{ color: 'var(--t3)' }}>{a.clicks} clicks · <b style={{ color: 'var(--green-text)' }}>{a.conversions} gifts</b></span>
              </div>
            ))}
          </div>

          {/* ── Send history ── */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Send history</h3>
            {data.history.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--t3)' }}>No sends yet.</p>}
            {data.history.map(h => (
              <div key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--t1)' }}>{h.subject}</div>
                <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>
                  {dt(h.created_at)} · {h.target_group.replaceAll('_', ' ')} · sent {h.sent_count}/{h.recipient_count}
                  {h.suppressed_count > 0 && ` · ${h.suppressed_count} skipped`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
