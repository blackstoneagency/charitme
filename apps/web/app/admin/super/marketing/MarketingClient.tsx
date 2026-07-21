'use client';

import React, { useState } from 'react';

export type SeoRow = {
  id: string; route: string; title: string | null; meta_description: string | null;
  keywords: string | null; og_title: string | null; og_description: string | null;
  og_image_url: string | null; canonical_url: string | null; noindex: boolean;
};
export type AeoRow = {
  id: string; question: string; answer: string; topic: string | null;
  schema_type: string; priority: number; published: boolean;
};
export type CampaignRow = {
  id: string; name: string; campaign_type: string | null; status: string;
  subject: string | null; sent_count: number | null; open_count: number | null;
  click_count: number | null; revenue_cents: number | null; created_at: string;
};

const input: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 13 };
const btn: React.CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 };
const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--t2)', border: '1px solid var(--b2)' };

function fmtMoney(c: number | null) { return `$${Math.round((c ?? 0) / 100).toLocaleString()}`; }

export default function MarketingClient({ seo, aeo, campaigns }: { seo: SeoRow[]; aeo: AeoRow[]; campaigns: CampaignRow[] }) {
  const [tab, setTab] = useState<'seo' | 'aeo' | 'campaigns'>('seo');
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  return (
    <div style={{ padding: '0 4px 48px' }}>
      <div className="kf-tabs" style={{ marginBottom: 18 }}>
        {(['seo', 'aeo', 'campaigns'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'seo' ? 'SEO' : t === 'aeo' ? 'AEO · Answer Engines' : 'Campaigns'}
          </button>
        ))}
      </div>

      {tab === 'seo' && <SeoTab rows={seo} flash={flash} />}
      {tab === 'aeo' && <AeoTab rows={aeo} flash={flash} />}
      {tab === 'campaigns' && <CampaignsTab rows={campaigns} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--t1)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>{toast}</div>
      )}
    </div>
  );
}

// ── SEO ───────────────────────────────────────────────────────────────────────
function SeoTab({ rows: initial, flash }: { rows: SeoRow[]; flash: (m: string) => void }) {
  const [rows, setRows] = useState(initial);
  const blank: SeoRow = { id: '', route: '/', title: '', meta_description: '', keywords: '', og_title: '', og_description: '', og_image_url: '', canonical_url: '', noindex: false };
  const [draft, setDraft] = useState<SeoRow>(blank);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft.route.startsWith('/')) { flash('Route must start with /'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/super/seo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRows((prev) => { const others = prev.filter((r) => r.route !== json.row.route); return [...others, json.row].sort((a, b) => a.route.localeCompare(b.route)); });
      setDraft(blank); flash(`Saved ${json.row.route}`);
    } catch (e) { flash(`Error: ${(e as Error).message}`); } finally { setBusy(false); }
  }
  async function del(id: string) {
    setBusy(true);
    try { await fetch(`/api/admin/super/seo?id=${id}`, { method: 'DELETE' }); setRows((p) => p.filter((r) => r.id !== id)); flash('Deleted'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'start' }}>
      <div className="kf-card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Per-route SEO ({rows.length})</h3>
        {rows.length === 0 && <p style={{ color: 'var(--t3)', fontSize: 13 }}>No routes configured yet. Add one on the right — it renders in each page&apos;s server metadata.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--b1)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <code style={{ fontSize: 12, color: 'var(--green-dark)' }}>{r.route}</code>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.noindex && <span className="kf-pill orange">noindex</span>}
                  <button style={{ ...btnGhost, padding: '3px 10px' }} onClick={() => setDraft(r)}>Edit</button>
                  <button style={{ ...btnGhost, padding: '3px 10px', color: 'var(--red)' }} onClick={() => del(r.id)} disabled={busy}>Delete</button>
                </div>
              </div>
              <strong style={{ display: 'block', fontSize: 13, marginTop: 6 }}>{r.title || <em style={{ color: 'var(--t4)' }}>no title</em>}</strong>
              <small style={{ color: 'var(--t3)' }}>{r.meta_description}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="kf-card" style={{ padding: 16, position: 'sticky', top: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{draft.id ? 'Edit route' : 'Add route'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Route<input style={input} value={draft.route} onChange={(e) => setDraft({ ...draft, route: e.target.value })} placeholder="/pricing" /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Title<input style={input} value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Meta description<textarea style={{ ...input, minHeight: 60 }} value={draft.meta_description ?? ''} onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })} /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Keywords<input style={input} value={draft.keywords ?? ''} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="fundraising, donate" /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>OG image URL<input style={input} value={draft.og_image_url ?? ''} onChange={(e) => setDraft({ ...draft, og_image_url: e.target.value })} /></label>
          <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--t2)' }}><input type="checkbox" checked={draft.noindex} onChange={(e) => setDraft({ ...draft, noindex: e.target.checked })} /> noindex (hide from search)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={save} disabled={busy}>{draft.id ? 'Update' : 'Add'} route</button>
            {draft.id !== '' && <button style={btnGhost} onClick={() => setDraft(blank)}>Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AEO ───────────────────────────────────────────────────────────────────────
function AeoTab({ rows: initial, flash }: { rows: AeoRow[]; flash: (m: string) => void }) {
  const [rows, setRows] = useState(initial);
  const blank: AeoRow = { id: '', question: '', answer: '', topic: '', schema_type: 'FAQPage', priority: 0, published: true };
  const [draft, setDraft] = useState<AeoRow>(blank);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (draft.question.trim().length < 3 || draft.answer.trim().length < 3) { flash('Question and answer required'); return; }
    setBusy(true);
    try {
      const editing = !!draft.id;
      const res = await fetch('/api/admin/super/aeo', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRows((prev) => editing ? prev.map((r) => (r.id === json.row.id ? json.row : r)) : [json.row, ...prev]);
      setDraft(blank); flash('Saved');
    } catch (e) { flash(`Error: ${(e as Error).message}`); } finally { setBusy(false); }
  }
  async function togglePublish(r: AeoRow) {
    const res = await fetch('/api/admin/super/aeo', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, published: !r.published }) });
    const json = await res.json();
    if (res.ok) setRows((p) => p.map((x) => (x.id === r.id ? json.row : x)));
  }
  async function del(id: string) { await fetch(`/api/admin/super/aeo?id=${id}`, { method: 'DELETE' }); setRows((p) => p.filter((r) => r.id !== id)); flash('Deleted'); }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'start' }}>
      <div className="kf-card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Answer-Engine entries ({rows.length})</h3>
        <p style={{ color: 'var(--t3)', fontSize: 12, margin: '0 0 12px' }}>Q&amp;A published here renders as structured data (FAQ/QA schema) so answer engines and AI assistants can cite CharitMe.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--b1)', borderRadius: 10, padding: 12, opacity: r.published ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{r.question}</strong>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span className="kf-pill violet">{r.schema_type}</span>
                  <button style={{ ...btnGhost, padding: '3px 10px' }} onClick={() => togglePublish(r)}>{r.published ? 'Unpublish' : 'Publish'}</button>
                  <button style={{ ...btnGhost, padding: '3px 10px' }} onClick={() => setDraft(r)}>Edit</button>
                  <button style={{ ...btnGhost, padding: '3px 10px', color: 'var(--red)' }} onClick={() => del(r.id)}>Delete</button>
                </div>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--t2)' }}>{r.answer}</p>
              {r.topic && <small style={{ color: 'var(--t3)' }}>Topic: {r.topic} · priority {r.priority}</small>}
            </div>
          ))}
          {rows.length === 0 && <p style={{ color: 'var(--t3)', fontSize: 13 }}>No entries yet.</p>}
        </div>
      </div>
      <div className="kf-card" style={{ padding: 16, position: 'sticky', top: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{draft.id ? 'Edit entry' : 'New entry'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Question<input style={input} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Answer<textarea style={{ ...input, minHeight: 90 }} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Topic<input style={input} value={draft.topic ?? ''} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--t3)', flex: 1 }}>Schema<select style={input} value={draft.schema_type} onChange={(e) => setDraft({ ...draft, schema_type: e.target.value })}><option>FAQPage</option><option>QAPage</option><option>HowTo</option></select></label>
            <label style={{ fontSize: 12, color: 'var(--t3)', width: 90 }}>Priority<input type="number" style={input} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} /></label>
          </div>
          <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--t2)' }}><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> Published</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={save} disabled={busy}>{draft.id ? 'Update' : 'Create'}</button>
            {draft.id !== '' && <button style={btnGhost} onClick={() => setDraft(blank)}>Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Campaigns ───────────────────────────────────────────────────────────────
function CampaignsTab({ rows }: { rows: CampaignRow[] }) {
  return (
    <div className="kf-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Marketing campaigns ({rows.length})</h3>
        <a href="/admin/marketing/campaigns" style={btn}>Open campaign builder</a>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--t3)', fontSize: 12 }}>
            <th style={{ padding: '8px 10px' }}>Campaign</th><th>Type</th><th>Status</th><th style={{ textAlign: 'right' }}>Sent</th><th style={{ textAlign: 'right' }}>Opens</th><th style={{ textAlign: 'right' }}>Clicks</th><th style={{ textAlign: 'right' }}>Revenue</th>
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--b1)' }}>
                <td style={{ padding: '10px' }}><strong style={{ fontSize: 13 }}>{c.name}</strong>{c.subject && <small style={{ display: 'block', color: 'var(--t3)' }}>{c.subject}</small>}</td>
                <td style={{ fontSize: 13 }}>{c.campaign_type ?? '—'}</td>
                <td><span className={`kf-pill ${c.status === 'sent' ? 'green' : c.status === 'scheduled' ? 'orange' : 'violet'}`}>{c.status}</span></td>
                <td style={{ textAlign: 'right', fontSize: 13 }}>{(c.sent_count ?? 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontSize: 13 }}>{(c.open_count ?? 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontSize: 13 }}>{(c.click_count ?? 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{fmtMoney(c.revenue_cents)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
