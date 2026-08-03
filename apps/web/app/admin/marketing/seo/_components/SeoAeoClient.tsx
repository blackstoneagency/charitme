'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface SeoRow {
  id: string;
  route: string;
  title: string | null;
  meta_description: string | null;
  keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  noindex: boolean;
  updated_at: string;
}

export interface AeoRow {
  id: string;
  question: string;
  answer: string;
  topic: string | null;
  route: string;
  schema_type: string;
  priority: number;
  published: boolean;
  updated_at: string;
}

export interface SeoAeoCoverage {
  publicRoutes: number;
  seoConfigured: number;
  aeoCovered: number;
  staleSeo: number;
  staleAeo: number;
  missingAeoRoutes: string[];
}

const box: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14, background: 'var(--s2)', color: 'var(--t1)' };
const area: React.CSSProperties = { ...input, height: 'auto', minHeight: 72, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--t3)', margin: '10px 0 4px', display: 'block' };
const btn: React.CSSProperties = { height: 40, padding: '0 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7035ff,#ec39c3)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid var(--b2)', background: 'var(--s2)', color: 'var(--t1)', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const h2: React.CSSProperties = { fontSize: 18, fontWeight: 900, color: 'var(--t1)', margin: '0 0 4px' };

const EMPTY_SEO = { id: '', route: '', title: '', meta_description: '', keywords: '', og_title: '', og_description: '', og_image_url: '', canonical_url: '', noindex: false };
const EMPTY_AEO = { id: '', question: '', answer: '', topic: '', route: '/faq', schema_type: 'FAQPage', priority: 0, published: true };

export default function SeoAeoClient({ initialSeo, initialAeo, coverage, initialTab = 'seo' }: { initialSeo: SeoRow[]; initialAeo: AeoRow[]; coverage: SeoAeoCoverage; initialTab?: 'seo' | 'aeo' }) {
  const router = useRouter();
  // The parent Marketing page owns which of SEO/AEO is showing (it renders this
  // component with a `key` per tab, so local state starts from the right one).
  const [tab, setTab] = useState<'seo' | 'aeo'>(initialTab);
  const [seoForm, setSeoForm] = useState<typeof EMPTY_SEO>(EMPTY_SEO);
  const [aeoForm, setAeoForm] = useState<typeof EMPTY_AEO>(EMPTY_AEO);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function flash(kind: 'ok' | 'err', text: string) { setMsg({ kind, text }); setTimeout(() => setMsg(null), 3500); }

  async function saveSeo(e: React.FormEvent) {
    e.preventDefault();
    if (!seoForm.route.trim()) return flash('err', 'Route is required (e.g. /pricing)');
    setBusy(true);
    const res = await fetch('/api/admin/seo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: seoForm.id || undefined, route: seoForm.route, title: seoForm.title, metaDescription: seoForm.meta_description,
        keywords: seoForm.keywords, ogTitle: seoForm.og_title, ogDescription: seoForm.og_description,
        ogImageUrl: seoForm.og_image_url, canonicalUrl: seoForm.canonical_url, noindex: seoForm.noindex,
      }),
    });
    setBusy(false);
    if (res.ok) { setSeoForm(EMPTY_SEO); flash('ok', 'SEO override saved'); router.refresh(); }
    else flash('err', (await res.json().catch(() => ({}))).error ?? 'Save failed');
  }

  async function saveAeo(e: React.FormEvent) {
    e.preventDefault();
    if (!aeoForm.question.trim() || !aeoForm.answer.trim()) return flash('err', 'Question and answer are required');
    setBusy(true);
    const res = await fetch('/api/admin/aeo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: aeoForm.id || undefined, question: aeoForm.question, answer: aeoForm.answer, topic: aeoForm.topic,
        route: aeoForm.route, schemaType: aeoForm.schema_type, priority: Number(aeoForm.priority) || 0, published: aeoForm.published,
      }),
    });
    setBusy(false);
    if (res.ok) { setAeoForm(EMPTY_AEO); flash('ok', 'AEO entry saved'); router.refresh(); }
    else flash('err', (await res.json().catch(() => ({}))).error ?? 'Save failed');
  }

  async function remove(kind: 'seo' | 'aeo', id: string) {
    if (!confirm('Delete this entry?')) return;
    const res = await fetch(`/api/admin/${kind}?id=${id}`, { method: 'DELETE' });
    if (res.ok) { flash('ok', 'Deleted'); router.refresh(); } else flash('err', 'Delete failed');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
      <div style={{ ...box, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <div>
          <h2 style={h2}>Search coverage</h2>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0' }}>Live coverage calculated from the public route registry and Supabase content.</p>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          <CoverageMetric label="Public routes" value={`${coverage.publicRoutes}`} />
          <CoverageMetric label="SEO configured" value={`${coverage.seoConfigured}/${coverage.publicRoutes}`} tone={coverage.seoConfigured === coverage.publicRoutes ? 'good' : 'warn'} />
          <CoverageMetric label="AEO covered" value={`${coverage.aeoCovered}/${coverage.publicRoutes}`} tone={coverage.aeoCovered === coverage.publicRoutes ? 'good' : 'warn'} />
          <CoverageMetric label="Stale SEO" value={`${coverage.staleSeo}`} tone={coverage.staleSeo === 0 ? 'good' : 'warn'} />
          <CoverageMetric label="Stale AEO" value={`${coverage.staleAeo}`} tone={coverage.staleAeo === 0 ? 'good' : 'warn'} />
        </div>
        {coverage.missingAeoRoutes.length > 0 && <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>Missing published AEO: {coverage.missingAeoRoutes.join(', ')}</p>}
      </div>
      {msg && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 10, fontWeight: 700, fontSize: 14, color: '#fff', background: msg.kind === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', minWidth: 0, gap: 8 }}>
        <button style={{ ...btnGhost, ...(tab === 'seo' ? { borderColor: '#7035ff', color: 'var(--brand-text)' } : {}) }} onClick={() => setTab('seo')}>SEO route overrides ({initialSeo.length})</button>
        <button style={{ ...btnGhost, ...(tab === 'aeo' ? { borderColor: '#7035ff', color: 'var(--brand-text)' } : {}) }} onClick={() => setTab('aeo')}>AEO answers ({initialAeo.length})</button>
      </div>

      {tab === 'seo' && (
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0,1fr)' }}>
          <form style={box} onSubmit={saveSeo}>
            <h2 style={h2}>{seoForm.id ? 'Edit' : 'Add'} route SEO override</h2>
            <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 6px' }}>Overrides title/description/OG/canonical/noindex for a specific route.</p>
             <label htmlFor="admin-seo-route" style={label}>Route (path)</label>
             <input id="admin-seo-route" style={input} value={seoForm.route} onChange={e => setSeoForm({ ...seoForm, route: e.target.value })} placeholder="/pricing" />
             <label htmlFor="admin-seo-title" style={label}>Title</label>
             <input id="admin-seo-title" style={input} value={seoForm.title ?? ''} onChange={e => setSeoForm({ ...seoForm, title: e.target.value })} maxLength={200} placeholder="Transparent Fundraising Fees | CharitMe" />
             <label htmlFor="admin-seo-description" style={label}>Meta description</label>
             <textarea id="admin-seo-description" style={area} value={seoForm.meta_description ?? ''} onChange={e => setSeoForm({ ...seoForm, meta_description: e.target.value })} maxLength={500} />
             <label htmlFor="admin-seo-keywords" style={label}>Keywords</label>
             <input id="admin-seo-keywords" style={input} value={seoForm.keywords ?? ''} onChange={e => setSeoForm({ ...seoForm, keywords: e.target.value })} placeholder="fundraising fees, gofundme alternative" />
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
               <div><label htmlFor="admin-seo-og-title" style={label}>OG title</label><input id="admin-seo-og-title" style={input} value={seoForm.og_title ?? ''} onChange={e => setSeoForm({ ...seoForm, og_title: e.target.value })} /></div>
               <div><label htmlFor="admin-seo-og-image" style={label}>OG image URL</label><input id="admin-seo-og-image" style={input} value={seoForm.og_image_url ?? ''} onChange={e => setSeoForm({ ...seoForm, og_image_url: e.target.value })} /></div>
            </div>
             <label htmlFor="admin-seo-og-description" style={label}>OG description</label>
             <textarea id="admin-seo-og-description" style={area} value={seoForm.og_description ?? ''} onChange={e => setSeoForm({ ...seoForm, og_description: e.target.value })} maxLength={500} />
             <label htmlFor="admin-seo-canonical" style={label}>Canonical URL</label>
             <input id="admin-seo-canonical" style={input} value={seoForm.canonical_url ?? ''} onChange={e => setSeoForm({ ...seoForm, canonical_url: e.target.value })} placeholder="https://www.charitme.com/pricing" />
            <label style={{ ...label, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={seoForm.noindex} onChange={e => setSeoForm({ ...seoForm, noindex: e.target.checked })} /> noindex (hide from search engines)
            </label>
            <div style={{ display: 'flex', minWidth: 0, gap: 8, marginTop: 14 }}>
              <button type="submit" style={btn} disabled={busy}>{busy ? 'Saving…' : seoForm.id ? 'Update override' : 'Add override'}</button>
              {seoForm.id && <button type="button" style={btnGhost} onClick={() => setSeoForm(EMPTY_SEO)}>Cancel</button>}
            </div>
          </form>

          <div style={box}>
            <h2 style={h2}>Route overrides</h2>
            {initialSeo.length === 0 ? <p style={{ color: 'var(--t3)', fontSize: 14 }}>No route overrides yet. Add one above.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                {initialSeo.map(r => (
                  <div key={r.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--b1)', borderRadius: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, color: 'var(--t1)', fontSize: 14 }}>{r.route} {r.noindex && <span style={{ fontSize: 11, color: 'var(--red-text)' }}>· noindex</span>}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || r.meta_description || '—'}</div>
                    </div>
                    <button style={btnGhost} onClick={() => { setSeoForm({ ...EMPTY_SEO, ...r, title: r.title ?? '', meta_description: r.meta_description ?? '', keywords: r.keywords ?? '', og_title: r.og_title ?? '', og_description: r.og_description ?? '', og_image_url: r.og_image_url ?? '', canonical_url: r.canonical_url ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                    <button style={{ ...btnGhost, color: 'var(--red-text)' }} onClick={() => remove('seo', r.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'aeo' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
          <form style={box} onSubmit={saveAeo}>
            <h2 style={h2}>{aeoForm.id ? 'Edit' : 'Add'} AEO answer</h2>
            <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 6px' }}>Concise, factual Q&A that AI search engines and FAQ rich results can cite. Published entries are the source of truth for the public AEO surface.</p>
             <label htmlFor="admin-aeo-question" style={label}>Question</label>
             <input id="admin-aeo-question" style={input} value={aeoForm.question} onChange={e => setAeoForm({ ...aeoForm, question: e.target.value })} maxLength={300} placeholder="How much does CharitMe charge to start a fundraiser?" />
             <label htmlFor="admin-aeo-answer" style={label}>Answer</label>
             <textarea id="admin-aeo-answer" style={area} value={aeoForm.answer} onChange={e => setAeoForm({ ...aeoForm, answer: e.target.value })} maxLength={4000} />
             <label htmlFor="admin-aeo-route" style={label}>Public route</label>
             <input id="admin-aeo-route" style={input} value={aeoForm.route} onChange={e => setAeoForm({ ...aeoForm, route: e.target.value })} maxLength={200} placeholder="/faq" />
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
               <div><label htmlFor="admin-aeo-topic" style={label}>Topic</label><input id="admin-aeo-topic" style={input} value={aeoForm.topic ?? ''} onChange={e => setAeoForm({ ...aeoForm, topic: e.target.value })} placeholder="Fees" /></div>
               <div><label htmlFor="admin-aeo-schema" style={label}>Schema type</label>
                 <select id="admin-aeo-schema" style={input} value={aeoForm.schema_type} onChange={e => setAeoForm({ ...aeoForm, schema_type: e.target.value })}>
                  <option value="FAQPage">FAQPage</option><option value="QAPage">QAPage</option><option value="HowTo">HowTo</option>
                </select>
              </div>
               <div><label htmlFor="admin-aeo-priority" style={label}>Priority</label><input id="admin-aeo-priority" style={input} type="number" value={aeoForm.priority} onChange={e => setAeoForm({ ...aeoForm, priority: Number(e.target.value) })} min={0} max={1000} /></div>
            </div>
            <label style={{ ...label, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={aeoForm.published} onChange={e => setAeoForm({ ...aeoForm, published: e.target.checked })} /> Published
            </label>
            <div style={{ display: 'flex', minWidth: 0, gap: 8, marginTop: 14 }}>
              <button type="submit" style={btn} disabled={busy}>{busy ? 'Saving…' : aeoForm.id ? 'Update answer' : 'Add answer'}</button>
              {aeoForm.id && <button type="button" style={btnGhost} onClick={() => setAeoForm(EMPTY_AEO)}>Cancel</button>}
            </div>
          </form>

          <div style={box}>
            <h2 style={h2}>Answers ({initialAeo.length})</h2>
            {initialAeo.length === 0 ? <p style={{ color: 'var(--t3)', fontSize: 14 }}>No AEO answers yet. Add one above.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                {initialAeo.map(a => (
                  <div key={a.id} style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 10, padding: '12px', border: '1px solid var(--b1)', borderRadius: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, color: 'var(--t1)', fontSize: 14 }}>{a.question} {!a.published && <span style={{ fontSize: 11, color: 'var(--t4)' }}>· draft</span>}</div>
                      <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.45, marginTop: 3 }}>{a.answer.length > 160 ? a.answer.slice(0, 160) + '…' : a.answer}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--t4)', marginTop: 4 }}>{a.topic ? `${a.topic} · ` : ''}{a.schema_type} · priority {a.priority}</div>
                    </div>
                    <button style={btnGhost} onClick={() => { setAeoForm({ ...EMPTY_AEO, ...a, topic: a.topic ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                    <button style={{ ...btnGhost, color: 'var(--red-text)' }} onClick={() => remove('aeo', a.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' }) {
  const color = tone === 'good' ? 'var(--green)' : tone === 'warn' ? 'var(--orange)' : 'var(--t1)';
  return <div style={{ border: '1px solid var(--b1)', borderRadius: 10, padding: '12px 14px', background: 'var(--s2)' }}><div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div><div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--t3)' }}>{label}</div></div>;
}
