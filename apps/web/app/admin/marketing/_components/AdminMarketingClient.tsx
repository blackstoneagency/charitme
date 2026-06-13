'use client';

import React, { useState, useEffect, useCallback } from 'react';

/* ── shared styles ── */
const card: React.CSSProperties = { background: '#fff', border: '1px solid #eef0f7', borderRadius: 14, padding: '20px 24px', marginBottom: 16 };
const btn: React.CSSProperties = { padding: '8px 18px', background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 650, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 18px', background: '#f8f9fc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const input: React.CSSProperties = { padding: '9px 14px', borderRadius: 9, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #eef0f7' };
const td: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f5f6fa' };

const TABS = [
  { key: 'overview',    label: 'Overview' },
  { key: 'audience',    label: 'Audience' },
  { key: 'segments',    label: 'Segments' },
  { key: 'campaigns',   label: 'Campaigns' },
  { key: 'automations', label: 'Automations' },
  { key: 'copilot',     label: 'AI Copilot' },
] as const;
type TabKey = typeof TABS[number]['key'];

/* ── types ── */
interface Contact {
  id: string; email: string | null; first_name: string | null; last_name: string | null;
  client_type: string; lifecycle_stage: string; lead_score: number; engagement_score: number;
  donor_value_cents: number; donation_count: number; churn_risk: string; status: string;
  last_touch_source: string | null; country: string | null; last_active_at: string | null;
}
interface Segment { id: string; name: string; description: string | null; member_count: number; is_system: boolean; rules: { logic: string; conditions: { field: string; op: string; value: string | number }[] } }
interface Campaign { id: string; name: string; campaign_type: string; status: string; subject: string | null; body: string | null; sent_count: number; open_count: number; click_count: number; segment_id: string | null; marketing_segments?: { name: string; member_count: number } | null }
interface Automation { id: string; name: string; trigger_event: string; action_type: string; enabled: boolean; run_count: number; last_run_at: string | null }
interface AutomationRun { id: string; status: string; detail: string | null; created_at: string; marketing_automations?: { name: string } | null }
interface ContactProfile { contact: Contact; events: { id: string; event_type: string; created_at: string; amount_cents: number | null }[]; segments: { marketing_segments: { name: string } | null }[]; consent: { channel: string; granted: boolean; source: string | null; created_at: string }[]; identities: { kind: string; value: string }[] }

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const dt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function AdminMarketingClient({ initialTab = 'overview', overview }: {
  initialTab?: TabKey;
  overview: { contacts: number; byType: Record<string, number>; events7d: number; campaignsSent: number; topSegments: { name: string; member_count: number }[]; unsubscribed: number };
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [notice, setNotice] = useState('');
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 5000); };

  return (
    <div style={{ padding: '0 32px 48px', maxWidth: 1100 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f8f9fc', borderRadius: 12, padding: 4, border: '1px solid #eef0f7', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 650, cursor: 'pointer',
              background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#6c35ff' : '#64748b',
              boxShadow: tab === t.key ? '0 1px 6px rgba(0,0,0,.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {notice && <div style={{ ...card, padding: '12px 18px', background: notice.startsWith('❌') ? '#fff0f3' : '#f0fdf4', borderColor: notice.startsWith('❌') ? '#fecdd3' : '#bbf7d0', fontWeight: 700, fontSize: 13, color: notice.startsWith('❌') ? '#be123c' : '#15803d' }}>{notice}</div>}

      {tab === 'overview'    && <OverviewTab overview={overview} go={setTab} />}
      {tab === 'audience'    && <AudienceTab flash={flash} />}
      {tab === 'segments'    && <SegmentsTab flash={flash} />}
      {tab === 'campaigns'   && <CampaignsTab flash={flash} />}
      {tab === 'automations' && <AutomationsTab flash={flash} />}
      {tab === 'copilot'     && <CopilotTab flash={flash} />}
    </div>
  );
}

/* ═══════════ Overview ═══════════ */
function OverviewTab({ overview, go }: { overview: React.ComponentProps<typeof AdminMarketingClient>['overview']; go: (t: TabKey) => void }) {
  const kpis = [
    { label: 'Total contacts', value: overview.contacts.toLocaleString(), tab: 'audience' as TabKey },
    { label: 'Events (7 days)', value: overview.events7d.toLocaleString(), tab: 'audience' as TabKey },
    { label: 'Campaigns sent', value: overview.campaignsSent.toLocaleString(), tab: 'campaigns' as TabKey },
    { label: 'Unsubscribed', value: overview.unsubscribed.toLocaleString(), tab: 'audience' as TabKey },
  ];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {kpis.map(k => (
          <button key={k.label} onClick={() => go(k.tab)} style={{ ...card, marginBottom: 0, textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, fontWeight: 650, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#1a1a2e', marginTop: 6 }}>{k.value}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#1a1a2e' }}>Contacts by type</div>
          {Object.keys(overview.byType).length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>No contacts yet. Use Audience → “Sync platform users” to import donors and organizers, or capture leads from site forms.</p>}
          {Object.entries(overview.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f5f6fa', fontSize: 13 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{type.replaceAll('_', ' ')}</span>
              <b style={{ color: '#1a1a2e' }}>{count}</b>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#1a1a2e' }}>Top segments</div>
          {overview.topSegments.map(s => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f5f6fa', fontSize: 13 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{s.name}</span>
              <b style={{ color: '#6c35ff' }}>{s.member_count}</b>
            </div>
          ))}
          <button onClick={() => go('segments')} style={{ ...btnGhost, marginTop: 12 }}>Manage segments →</button>
        </div>
      </div>

      <div style={{ ...card, background: '#f7f2ff', borderColor: '#e0d5ff' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#4d1ee0', marginBottom: 6 }}>Capture endpoint</div>
        <p style={{ fontSize: 13, color: '#5b3fa8', margin: 0, lineHeight: 1.6 }}>
          POST <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 6 }}>/api/marketing/capture</code> with{' '}
          <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 6 }}>{'{ email, event, utmSource, ... }'}</code> from any form, popup, or page.
          Identity is resolved automatically; events feed segments, scores, and attribution.
          Unsubscribes: <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 6 }}>/api/marketing/unsubscribe</code>.
        </p>
      </div>
    </div>
  );
}

/* ═══════════ Audience ═══════════ */
function AudienceTab({ flash }: { flash: (m: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');
  const [profile, setProfile] = useState<ContactProfile | null>(null);

  const load = useCallback(async (search = '') => {
    setLoading(true);
    const res = await fetch(`/api/admin/marketing/contacts${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    const d = await res.json() as { contacts?: Contact[]; total?: number };
    setContacts(d.contacts ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    const res = await fetch('/api/admin/marketing/contacts', { method: 'PATCH' });
    const d = await res.json() as { imported?: number; error?: string };
    flash(res.ok ? `✓ Synced ${d.imported} platform users into marketing contacts` : `❌ ${d.error}`);
    setSyncing(false);
    void load();
  };

  const addLead = async () => {
    if (!leadEmail.trim()) return;
    const res = await fetch('/api/admin/marketing/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: leadEmail.trim(), clientType: 'lead' }),
    });
    const d = await res.json() as { error?: string };
    flash(res.ok ? '✓ Lead added' : `❌ ${d.error}`);
    setLeadEmail('');
    void load();
  };

  const openProfile = async (id: string) => {
    const res = await fetch(`/api/admin/marketing/contacts?id=${id}`);
    if (res.ok) setProfile(await res.json() as ContactProfile);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && void load(q)} placeholder="Search email or name…" style={{ ...input, flex: '1 1 220px' }} />
        <button onClick={() => void load(q)} style={btnGhost}>Search</button>
        <button onClick={() => void sync()} disabled={syncing} style={btn}>{syncing ? 'Syncing…' : '⟳ Sync platform users'}</button>
        <input value={leadEmail} onChange={e => setLeadEmail(e.target.value)} placeholder="new-lead@email.com" style={{ ...input, width: 200 }} />
        <button onClick={() => void addLead()} style={btnGhost}>+ Add lead</button>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Contact</th><th style={th}>Type</th><th style={th}>Stage</th>
            <th style={th}>Lead score</th><th style={th}>Engagement</th><th style={th}>Lifetime value</th>
            <th style={th}>Churn risk</th><th style={th}>Last active</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td style={td} colSpan={8}>Loading…</td></tr>}
            {!loading && contacts.length === 0 && <tr><td style={td} colSpan={8}>No contacts yet — sync platform users or capture leads from site forms.</td></tr>}
            {contacts.map(c => (
              <tr key={c.id} onClick={() => void openProfile(c.id)} style={{ cursor: 'pointer' }}>
                <td style={td}>
                  <div style={{ fontWeight: 650, color: '#1a1a2e' }}>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.email}</div>
                </td>
                <td style={td}><Pill text={c.client_type.replaceAll('_', ' ')} color="#6c35ff" /></td>
                <td style={td}>{c.lifecycle_stage}</td>
                <td style={td}><ScoreBar value={c.lead_score} /></td>
                <td style={td}><ScoreBar value={c.engagement_score} /></td>
                <td style={td}><b>{money(c.donor_value_cents)}</b></td>
                <td style={td}><Pill text={c.churn_risk} color={c.churn_risk === 'high' ? '#dc2626' : c.churn_risk === 'medium' ? '#d97706' : '#059669'} /></td>
                <td style={td}>{dt(c.last_active_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>{total.toLocaleString()} contacts total · click a row for the full profile</p>

      {profile && <ProfileDrawer profile={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}

function ProfileDrawer({ profile, onClose }: { profile: ContactProfile; onClose: () => void }) {
  const c = profile.contact;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 92vw)', background: '#fff', height: '100%', overflowY: 'auto', padding: '28px 28px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</h3>
          <button onClick={onClose} style={{ ...btnGhost, padding: '4px 12px' }}>✕</button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#94a3b8' }}>{c.email}{c.country ? ` · ${c.country}` : ''}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            ['Type', c.client_type.replaceAll('_', ' ')], ['Stage', c.lifecycle_stage],
            ['Lead score', String(c.lead_score)], ['Engagement', String(c.engagement_score)],
            ['Donations', String(c.donation_count)], ['Lifetime value', money(c.donor_value_cents)],
            ['Churn risk', c.churn_risk], ['Status', c.status],
            ['First touch', c.last_touch_source ?? '—'], ['Last active', dt(c.last_active_at)],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#f8f9fc', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 650, color: '#1a1a2e', marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        <Section title={`Segments (${profile.segments.length})`}>
          {profile.segments.map((s, i) => <Pill key={i} text={s.marketing_segments?.name ?? '—'} color="#6c35ff" />)}
          {profile.segments.length === 0 && <span style={{ fontSize: 13, color: '#94a3b8' }}>Not in any segment</span>}
        </Section>

        <Section title={`Identities (${profile.identities.length})`}>
          {profile.identities.map((idn, i) => (
            <div key={i} style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace', padding: '3px 0' }}>{idn.kind}: {idn.value}</div>
          ))}
        </Section>

        <Section title={`Consent history (${profile.consent.length})`}>
          {profile.consent.map((co, i) => (
            <div key={i} style={{ fontSize: 12.5, color: co.granted ? '#059669' : '#dc2626', padding: '3px 0' }}>
              {co.granted ? '✓ granted' : '✕ revoked'} · {co.channel} · {co.source} · {dt(co.created_at)}
            </div>
          ))}
          {profile.consent.length === 0 && <span style={{ fontSize: 13, color: '#94a3b8' }}>No consent records</span>}
        </Section>

        <Section title={`Event timeline (${profile.events.length})`}>
          {profile.events.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #f5f6fa' }}>
              <span style={{ fontWeight: 700, color: '#374151' }}>{e.event_type}{e.amount_cents ? ` · ${money(e.amount_cents)}` : ''}</span>
              <span style={{ color: '#94a3b8' }}>{dt(e.created_at)}</span>
            </div>
          ))}
          {profile.events.length === 0 && <span style={{ fontSize: 13, color: '#94a3b8' }}>No events yet</span>}
        </Section>
      </div>
    </div>
  );
}

/* ═══════════ Segments ═══════════ */
const FIELD_OPTIONS = ['donation_count', 'donor_value_cents', 'lead_score', 'engagement_score', 'client_type', 'lifecycle_stage', 'country', 'inactive_days', 'event'];
const OP_OPTIONS = ['eq', 'neq', 'gte', 'lte', 'has', 'not_has', 'contains'];

function SegmentsTab({ flash }: { flash: (m: string) => void }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [name, setName] = useState('');
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [conditions, setConditions] = useState<{ field: string; op: string; value: string }[]>([{ field: 'donation_count', op: 'gte', value: '1' }]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/marketing/segments');
    const d = await res.json() as { segments?: Segment[] };
    setSegments(d.segments ?? []);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const evaluate = async (id: string) => {
    const res = await fetch(`/api/admin/marketing/segments?id=${id}`, { method: 'PATCH' });
    const d = await res.json() as { matched?: number; error?: string };
    flash(res.ok ? `✓ Segment evaluated — ${d.matched} matching contacts` : `❌ ${d.error}`);
    void load();
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch('/api/admin/marketing/segments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        rules: { logic, conditions: conditions.map(c => ({ ...c, value: /^\d+$/.test(c.value) ? Number(c.value) : c.value })) },
      }),
    });
    const d = await res.json() as { segment?: Segment; error?: string };
    flash(res.ok ? `✓ Segment created — ${d.segment?.member_count ?? 0} matching contacts` : `❌ ${d.error}`);
    setName(''); setBusy(false);
    void load();
  };

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#1a1a2e' }}>Create segment</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Segment name" style={{ ...input, flex: '1 1 220px' }} />
          <select value={logic} onChange={e => setLogic(e.target.value as 'and' | 'or')} style={input}>
            <option value="and">Match ALL conditions</option>
            <option value="or">Match ANY condition</option>
          </select>
        </div>
        {conditions.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <select value={c.field} onChange={e => setConditions(cs => cs.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} style={input}>
              {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={c.op} onChange={e => setConditions(cs => cs.map((x, j) => j === i ? { ...x, op: e.target.value } : x))} style={input}>
              {OP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <input value={c.value} onChange={e => setConditions(cs => cs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="value" style={{ ...input, width: 160 }} />
            {conditions.length > 1 && <button onClick={() => setConditions(cs => cs.filter((_, j) => j !== i))} style={{ ...btnGhost, padding: '6px 12px' }}>✕</button>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConditions(cs => [...cs, { field: 'lead_score', op: 'gte', value: '50' }])} style={btnGhost}>+ Condition</button>
          <button onClick={() => void create()} disabled={busy || !name.trim()} style={btn}>{busy ? 'Creating…' : 'Create & evaluate'}</button>
        </div>
      </div>

      <div style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Segment</th><th style={th}>Rules</th><th style={th}>Members</th><th style={th}></th></tr></thead>
          <tbody>
            {segments.map(s => (
              <tr key={s.id}>
                <td style={td}>
                  <b style={{ color: '#1a1a2e' }}>{s.name}</b>{s.is_system && <Pill text="system" color="#94a3b8" />}
                  {s.description && <div style={{ fontSize: 12, color: '#94a3b8' }}>{s.description}</div>}
                </td>
                <td style={{ ...td, fontSize: 11.5, fontFamily: 'monospace', color: '#64748b' }}>
                  {s.rules.conditions.map((c, i) => `${i > 0 ? ` ${s.rules.logic.toUpperCase()} ` : ''}${c.field} ${c.op} ${c.value}`).join('')}
                </td>
                <td style={td}><b style={{ color: '#6c35ff', fontSize: 15 }}>{s.member_count}</b></td>
                <td style={td}><button onClick={() => void evaluate(s.id)} style={btnGhost}>⟳ Evaluate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════ Campaigns ═══════════ */
function CampaignsTab({ flash }: { flash: (m: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [form, setForm] = useState({ name: '', segment_id: '', subject: '', body: '' });
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cRes, sRes] = await Promise.all([fetch('/api/admin/marketing/campaigns'), fetch('/api/admin/marketing/segments')]);
    const c = await cRes.json() as { campaigns?: Campaign[] };
    const s = await sRes.json() as { segments?: Segment[] };
    setCampaigns(c.campaigns ?? []);
    setSegments(s.segments ?? []);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) { flash('❌ Name, subject, and body are required'); return; }
    setBusy(true);
    const res = await fetch('/api/admin/marketing/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, segment_id: form.segment_id || null, subject: form.subject, body: form.body, campaign_type: 'email' }),
    });
    const d = await res.json() as { error?: string };
    flash(res.ok ? '✓ Campaign created as draft' : `❌ ${d.error}`);
    if (res.ok) setForm({ name: '', segment_id: '', subject: '', body: '' });
    setBusy(false);
    void load();
  };

  const action = async (id: string, act: string) => {
    if (act === 'send_test' && !testEmail.trim()) { flash('❌ Enter a test email first'); return; }
    if (act === 'launch' && !confirm('Launch this campaign to all segment members?')) return;
    const res = await fetch('/api/admin/marketing/campaigns', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: act, testEmail: act === 'send_test' ? testEmail.trim() : undefined }),
    });
    const d = await res.json() as { sent?: number; suppressed?: number; error?: string; detail?: string };
    if (!res.ok) flash(`❌ ${d.error}`);
    else if (act === 'launch') flash(`✓ Launched — ${d.sent} sent, ${d.suppressed} suppressed${d.detail ? ` · ${d.detail}` : ''}`);
    else flash(d.detail ? `⚠ ${d.detail}` : `✓ ${act.replace('_', ' ')} done`);
    void load();
  };

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#1a1a2e' }}>New email campaign</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Internal name" style={input} />
          <select value={form.segment_id} onChange={e => setForm(f => ({ ...f, segment_id: e.target.value }))} style={input}>
            <option value="">Choose audience segment…</option>
            {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.member_count})</option>)}
          </select>
        </div>
        <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject — supports {{first_name}}" style={{ ...input, width: '100%', boxSizing: 'border-box', marginBottom: 10 }} />
        <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder={'Email body (plain text). Personalize with {{first_name}}.'} rows={5} style={{ ...input, width: '100%', boxSizing: 'border-box', marginBottom: 10, resize: 'vertical' }} />
        <button onClick={() => void create()} disabled={busy} style={btn}>{busy ? 'Creating…' : 'Create draft'}</button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@you.com (for Send test)" style={{ ...input, width: 260 }} />
      </div>

      <div style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Campaign</th><th style={th}>Audience</th><th style={th}>Status</th><th style={th}>Sent</th><th style={th}>Actions</th></tr></thead>
          <tbody>
            {campaigns.length === 0 && <tr><td style={td} colSpan={5}>No campaigns yet.</td></tr>}
            {campaigns.map(c => (
              <tr key={c.id}>
                <td style={td}>
                  <b style={{ color: '#1a1a2e' }}>{c.name}</b>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.subject}</div>
                </td>
                <td style={td}>{c.marketing_segments?.name ?? '—'}{c.marketing_segments ? ` (${c.marketing_segments.member_count})` : ''}</td>
                <td style={td}><Pill text={c.status} color={c.status === 'sent' ? '#059669' : c.status === 'draft' ? '#94a3b8' : '#d97706'} /></td>
                <td style={td}><b>{c.sent_count}</b></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button onClick={() => void action(c.id, 'send_test')} style={{ ...btnGhost, marginRight: 6, padding: '5px 10px', fontSize: 12 }}>Send test</button>
                  {(c.status === 'draft' || c.status === 'paused') && <button onClick={() => void action(c.id, 'launch')} style={{ ...btn, marginRight: 6, padding: '5px 12px', fontSize: 12 }}>Launch</button>}
                  {c.status !== 'archived' && <button onClick={() => void action(c.id, 'archive')} style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }}>Archive</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════ Automations ═══════════ */
function AutomationsTab({ flash }: { flash: (m: string) => void }) {
  const [autos, setAutos] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/marketing/automations');
    const d = await res.json() as { automations?: Automation[]; runs?: AutomationRun[] };
    setAutos(d.automations ?? []);
    setRuns(d.runs ?? []);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: 'enable' | 'disable' | 'run') => {
    const res = await fetch('/api/admin/marketing/automations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    const d = await res.json() as { matched?: number; executed?: number; skipped?: number; error?: string };
    if (!res.ok) flash(`❌ ${d.error}`);
    else if (action === 'run') flash(`✓ Run complete — ${d.matched} matched, ${d.executed} executed, ${d.skipped} skipped`);
    else flash(`✓ Automation ${action}d`);
    void load();
  };

  return (
    <div>
      <div style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Automation</th><th style={th}>Trigger</th><th style={th}>Action</th><th style={th}>Runs</th><th style={th}>Status</th><th style={th}></th></tr></thead>
          <tbody>
            {autos.map(a => (
              <tr key={a.id}>
                <td style={td}><b style={{ color: '#1a1a2e' }}>{a.name}</b></td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{a.trigger_event}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{a.action_type}</td>
                <td style={td}>{a.run_count}{a.last_run_at ? ` · last ${dt(a.last_run_at)}` : ''}</td>
                <td style={td}><Pill text={a.enabled ? 'enabled' : 'disabled'} color={a.enabled ? '#059669' : '#94a3b8'} /></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button onClick={() => void act(a.id, a.enabled ? 'disable' : 'enable')} style={{ ...btnGhost, marginRight: 6, padding: '5px 10px', fontSize: 12 }}>{a.enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => void act(a.id, 'run')} style={{ ...btn, padding: '5px 12px', fontSize: 12 }}>Run now</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#1a1a2e' }}>Recent runs</div>
        {runs.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No runs yet — click “Run now” on an automation.</p>}
        {runs.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid #f5f6fa' }}>
            <span><b style={{ color: '#374151' }}>{r.marketing_automations?.name ?? '—'}</b> · <span style={{ color: r.status === 'success' ? '#059669' : r.status === 'failed' ? '#dc2626' : '#94a3b8' }}>{r.status}</span>{r.detail ? ` · ${r.detail}` : ''}</span>
            <span style={{ color: '#94a3b8' }}>{dt(r.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════ AI Copilot ═══════════ */
const COPILOT_TASKS = [
  { key: 'analyze',       label: '📊 Analyze marketing performance' },
  { key: 'weekly_plan',   label: '🗓 Generate weekly marketing plan' },
  { key: 'campaign_copy', label: '✉️ Write campaign email' },
  { key: 'subject_lines', label: '💡 Generate subject lines' },
  { key: 'sms_copy',      label: '📱 Write SMS variants' },
  { key: 'social_post',   label: '📣 Write social posts' },
] as const;

function CopilotTab({ flash }: { flash: (m: string) => void }) {
  const [task, setTask] = useState<typeof COPILOT_TASKS[number]['key']>('analyze');
  const [context, setContext] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setResult('');
    const res = await fetch('/api/admin/marketing/copilot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, context: context || undefined }),
    });
    const d = await res.json() as { result?: string; error?: string };
    if (!res.ok) flash(`❌ ${d.error}`);
    else setResult(d.result ?? '');
    setBusy(false);
  };

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#1a1a2e' }}>AI Marketing Copilot</div>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 14px' }}>Grounded in your live contact, event, and campaign data.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {COPILOT_TASKS.map(t => (
            <button key={t.key} onClick={() => setTask(t.key)}
              style={{ ...btnGhost, background: task === t.key ? '#f0eaff' : '#f8f9fc', color: task === t.key ? '#6c35ff' : '#374151', borderColor: task === t.key ? '#c4b0ff' : '#e2e8f0' }}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea value={context} onChange={e => setContext(e.target.value)} rows={3}
          placeholder="Optional goal/context — e.g. 'Reactivate donors who gave to medical campaigns last spring'"
          style={{ ...input, width: '100%', boxSizing: 'border-box', marginBottom: 10, resize: 'vertical' }} />
        <button onClick={() => void run()} disabled={busy} style={btn}>{busy ? 'Thinking…' : '✨ Generate'}</button>
      </div>

      {result && (
        <div style={{ ...card, whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.7, color: '#374151' }}>{result}</div>
      )}
    </div>
  );
}

/* ── tiny helpers ── */
function Pill({ text, color }: { text: string; color: string }) {
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 650, color, background: `${color}18`, marginLeft: 4 }}>{text}</span>;
}
function ScoreBar({ value }: { value: number }) {
  const color = value >= 70 ? '#059669' : value >= 40 ? '#d97706' : '#94a3b8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 56, height: 6, background: '#eef0f7', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <b style={{ fontSize: 12, color }}>{value}</b>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
