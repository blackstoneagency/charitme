'use client';

import React, { useState, useMemo } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface ContentRecord {
  id: string;
  title: string;
  body: string;
  type: string;
  status: string;
  author: string;
  campaign_title: string;
  created_at: string;
  updated_at: string;
}

export interface ContentClientProps {
  totalContent: number;
  publishedCount: number;
  draftCount: number;
  archivedCount: number;
  aiGeneratedCount: number;
  contentByType: { type: string; count: number }[];
  content: ContentRecord[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

// ─────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone = s.includes('published') || s.includes('active') ? 'green'
    : s.includes('draft') ? 'orange'
    : s.includes('archived') ? 'violet'
    : s.includes('ai') ? 'blue'
    : 'violet';
  const colors: Record<string, { bg: string; color: string }> = {
    green: { bg: '#def7e7', color: '#079447' },
    orange: { bg: '#fff0dc', color: '#f97316' },
    violet: { bg: '#efe8ff', color: '#551cf2' },
    blue: { bg: '#e8f0ff', color: '#2563eb' },
  };
  const c = colors[tone] ?? colors.violet;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 7, fontSize: 11, fontWeight: 950, background: c.bg, color: c.color }}>
      {capitalize(status)}
    </span>
  );
}

// ─────────────────────────────────────────────
// Donut chart
// ─────────────────────────────────────────────
function TypeDonut({ items }: { items: { type: string; count: number }[] }) {
  const colors = ['#6c35ff', '#ec3fb4', '#2f80ed', '#19b86a', '#f59e0b'];
  const total = items.reduce((s, x) => s + x.count, 1);
  const r = 56;
  const cx = 72;
  const cy = 72;
  const circumference = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg viewBox="0 0 144 144" style={{ width: 110, height: 110, flexShrink: 0 }}>
        {items.map((item, i) => {
          const frac = item.count / total;
          const dash = frac * circumference;
          const offset = items.slice(0, i).reduce((sum, previous) => sum + (previous.count / total), 0);
          return (
            <circle key={item.type}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="22"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset * circumference + circumference / 4}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 11} fill="#fff" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="950" fill="#101944">{total - 1}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#8c9ab5">Total</text>
      </svg>
      <div style={{ display: 'grid', gap: 7 }}>
        {items.map((item, i) => (
          <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#26335c' }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0, display: 'block' }} />
            <span>{item.type}</span>
            <b style={{ marginLeft: 'auto', color: '#0f0f30' }}>{item.count}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Content detail panel
// ─────────────────────────────────────────────
function ContentDetailPanel({ item, onClose }: { item: ContentRecord; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');
  const tabs = ['overview', 'content', 'history'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ marginLeft: 'auto', width: 520, background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-12px 0 56px rgba(20,20,80,.14)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <StatusPill status={item.status} />
              <span style={{ fontSize: 12, color: '#8c9ab5' }}>Updated {fmtDate(item.updated_at)}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 950, color: '#0f0f30', lineHeight: 1.3 }}>{item.title || 'Untitled'}</div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #eef0f7', padding: '0 24px' }}>
          {tabs.map(t => (
            <button key={t} type="button" onClick={() => setActiveTab(t)}
              style={{ height: 44, border: 0, borderBottom: `2px solid ${activeTab === t ? '#6c35ff' : 'transparent'}`, background: 'none', fontWeight: activeTab === t ? 950 : 750, fontSize: 13, color: activeTab === t ? '#551cf2' : '#66708d', marginRight: 20, cursor: 'pointer' }}>
              {capitalize(t)}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 24px', flex: 1 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gap: 2 }}>
              {/* Performance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Views', value: '—' },
                  { label: 'Engagement', value: '—' },
                  { label: 'Shares', value: '—' },
                  { label: 'Conversions', value: '—' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '14px', border: '1px solid #e6e9f2', borderRadius: 10, background: '#fbf9ff' }}>
                    <div style={{ fontSize: 12, color: '#66708d', fontWeight: 700 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 950, color: '#101944', marginTop: 4 }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {[
                ['Type', item.type],
                ['Author', item.author],
                ['Campaign', item.campaign_title],
                ['Status', item.status],
                ['Created', fmtDate(item.created_at)],
                ['Updated', fmtDate(item.updated_at)],
                ['Content ID', item.id.slice(0, 18) + '...'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <span style={{ color: '#66708d', fontWeight: 700 }}>{label}</span>
                  <span style={{ color: '#101944', fontWeight: 750, textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word' }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'content' && (
            <div>
              <div style={{ fontSize: 14, color: '#26335c', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', padding: '16px', background: '#fbf9ff', borderRadius: 10, border: '1px solid #e6e9f2' }}>
                {item.body || 'No content available.'}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { event: 'Content created', date: item.created_at, color: '#19b86a' },
                { event: 'Content updated', date: item.updated_at, color: '#6c35ff' },
              ].map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 750, color: '#101944' }}>{ev.event}</div>
                    <div style={{ fontSize: 12, color: '#8c9ab5', marginTop: 2 }}>{fmtDate(ev.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0f7', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" style={{ height: 40, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 750, cursor: 'pointer' }} onClick={() => alert('Edit')}>Edit Content</button>
            <button type="button" style={{ height: 40, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 750, cursor: 'pointer' }} onClick={() => alert('Duplicate')}>Duplicate</button>
          </div>
          <button type="button" style={{ height: 40, border: '1px solid #ff3b5f30', borderRadius: 9, background: '#fff0f3', color: '#ff3b5f', fontSize: 13, fontWeight: 850, cursor: 'pointer' }} onClick={() => alert('Delete')}>Delete Content</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create content wizard
// ─────────────────────────────────────────────
function CreateContentWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [contentType, setContentType] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishMode, setPublishMode] = useState('draft');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 520, background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(20,20,80,.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950, color: '#0f0f30' }}>Create New Content</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{ width: 28, height: 4, borderRadius: 2, background: step >= s ? '#6c35ff' : '#e6e9f2' }} />
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '24px' }}>
          {step === 1 && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 950, color: '#101944', marginBottom: 16 }}>Select Content Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {['Blog Post', 'Page', 'News', 'Media', 'Document', 'Other'].map(t => (
                  <button key={t} type="button"
                    onClick={() => setContentType(t)}
                    style={{ height: 52, border: `2px solid ${contentType === t ? '#6c35ff' : '#e6e9f2'}`, borderRadius: 10, background: contentType === t ? '#f3ecff' : '#fff', color: contentType === t ? '#551cf2' : '#26335c', fontSize: 13, fontWeight: 750, cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 950, color: '#101944', marginBottom: 4 }}>Content Details</div>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Title
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`${contentType} title…`} style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Content
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your content here…" style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '10px 14px', fontSize: 14, minHeight: 120, resize: 'vertical' }} />
              </label>
            </div>
          )}
          {step === 3 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 950, color: '#101944', marginBottom: 4 }}>Review & Publish</div>
              <div style={{ padding: '14px', background: '#fbf9ff', borderRadius: 10, border: '1px solid #e6e9f2', fontSize: 13, lineHeight: 1.6 }}>
                <div><b>Type:</b> {contentType}</div>
                <div><b>Title:</b> {title || '(untitled)'}</div>
                <div><b>Body:</b> {body.slice(0, 100)}{body.length > 100 ? '…' : ''}</div>
              </div>
              {['Publish Now', 'Schedule for later', 'Save as Draft'].map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#26335c' }}>
                  <input type="radio" name="publish" value={m} checked={publishMode === m} onChange={e => setPublishMode(e.target.value)} />
                  {m}
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0f7', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {step > 1 && <button type="button" onClick={() => setStep(s => s - 1)} style={{ height: 42, padding: '0 20px', border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 750, cursor: 'pointer' }}>Back</button>}
          <button type="button" onClick={() => { if (step < 3) setStep(s => s + 1); else { alert(`Content saved as ${publishMode}`); onClose(); } }}
            disabled={step === 1 && !contentType}
            style={{ height: 42, padding: '0 24px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 950, cursor: 'pointer', opacity: (step === 1 && !contentType) ? 0.5 : 1 }}>
            {step < 3 ? 'Next →' : 'Save Content'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function ContentClient({
  totalContent, publishedCount, draftCount, aiGeneratedCount, contentByType, content,
}: ContentClientProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ContentRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState('content');

  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    let list = content;
    if (filterStatus !== 'all') list = list.filter(c => c.status.toLowerCase() === filterStatus);
    if (filterType !== 'all') list = list.filter(c => c.type.toLowerCase() === filterType.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q));
    }
    return list;
  }, [content, filterStatus, filterType, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const panelTabs = ['content', 'activity', 'reports', 'bulk', 'audit'];

  const recentActivity = content.slice(0, 5).map(c => ({
    title: c.title || 'Untitled',
    type: c.type,
    author: c.author,
    date: c.updated_at,
  }));

  return (
    <div style={{ padding: '0 32px 40px' }}>
      {/* KPI */}
      <div className="kf-metrics" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Content', value: totalContent.toLocaleString(), tone: 'violet', icon: 'doc' },
          { label: 'Published', value: publishedCount.toLocaleString(), tone: 'green', icon: 'check' },
          { label: 'Drafts', value: draftCount.toLocaleString(), tone: 'orange', icon: 'chart' },
          { label: 'AI Generated', value: aiGeneratedCount.toLocaleString(), tone: 'blue', icon: 'stack' },
        ].map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22} strokeLinecap="round" strokeLinejoin="round">
                {m.icon === 'doc' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></>}
                {m.icon === 'check' && <path d="M20 6L9 17l-5-5"/>}
                {m.icon === 'chart' && <><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></>}
                {m.icon === 'stack' && <><path d="M12 2l9 5-9 5-9-5 9-5Z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></>}
              </svg>
            </div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          </article>
        ))}
      </div>

      {/* Charts row */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card">
          <div className="kf-card-head"><h2>Content by Type</h2></div>
          <div style={{ padding: '10px 20px 20px' }}>
            <TypeDonut items={contentByType.length > 0 ? contentByType : [{ type: 'Campaign Updates', count: totalContent }]} />
          </div>
        </section>

        <section className="kf-card">
          <div className="kf-card-head"><h2>Recent Activity</h2></div>
          <div>
            {recentActivity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 20px', borderBottom: '1px solid #f0f2f8' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c35ff', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 850, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#66708d', marginTop: 2 }}>{a.type} · {a.author}</div>
                </div>
                <div style={{ fontSize: 11, color: '#8c9ab5', flexShrink: 0 }}>{fmtDate(a.date)}</div>
              </div>
            ))}
            {recentActivity.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No recent activity</div>}
          </div>
        </section>
      </div>

      {/* Main table section */}
      <section className="kf-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #eef0f7' }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {panelTabs.map(t => (
              <button key={t} type="button" onClick={() => setActiveTab(t)}
                style={{ height: 50, padding: '0 16px', border: 0, borderBottom: `2px solid ${activeTab === t ? '#6c35ff' : 'transparent'}`, background: 'none', fontWeight: activeTab === t ? 950 : 750, fontSize: 13, color: activeTab === t ? '#551cf2' : '#202b55', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {capitalize(t)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 950, cursor: 'pointer' }}>
            + Create Content
          </button>
        </div>

        {activeTab === 'content' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #eef0f7', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', background: '#fff' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#8c9ab5" strokeWidth={2} width={15} height={15}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search content…" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, width: '100%' }} />
              </label>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} style={{ height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', fontSize: 13, background: '#fff' }}>
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }} style={{ height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', fontSize: 13, background: '#fff' }}>
                <option value="all">All Types</option>
                {contentByType.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
              </select>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 120px 130px', gap: 12, padding: '10px 20px', background: '#f8f9fc', borderBottom: '1px solid #eef0f7', fontSize: 11, fontWeight: 900, color: '#8c9ab5', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Title</span>
              <span>Type</span>
              <span>Status</span>
              <span>Author</span>
              <span>Updated</span>
            </div>

            {currentPage.map(c => (
              <div key={c.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 120px 130px', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer', alignItems: 'center' }}
                onClick={() => setSelected(c)}
                onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 850, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Untitled'}</div>
                  <div style={{ fontSize: 11, color: '#8c9ab5', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body.slice(0, 60)}{c.body.length > 60 ? '…' : ''}</div>
                </div>
                <span style={{ fontSize: 12, color: '#66708d', fontWeight: 700 }}>{c.type}</span>
                <StatusPill status={c.status} />
                <span style={{ fontSize: 12, color: '#66708d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.author}</span>
                <span style={{ fontSize: 12, color: '#8c9ab5' }}>{fmtDate(c.updated_at)}</span>
              </div>
            ))}

            {currentPage.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No content found</div>}

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #eef0f7' }}>
              <span style={{ fontSize: 13, color: '#66708d' }}>Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}>← Prev</button>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page >= pages - 1 ? 'default' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, fontSize: 13 }}>Next →</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 950 }}>Content Activity</h3>
            {content.slice(0, 8).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c35ff', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 850, color: '#101944' }}>{c.title || 'Untitled'}</span>
                  <span style={{ color: '#66708d', marginLeft: 6 }}>was updated</span>
                </div>
                <span style={{ color: '#8c9ab5', flexShrink: 0 }}>{fmtDate(c.updated_at)}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reports' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 950 }}>Content Reports</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 13 }}>
                <option>Performance Report</option>
                <option>Engagement Report</option>
                <option>Content Summary</option>
              </select>
              <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 13 }}>
                <option>Last 30 Days</option>
                <option>Last 90 Days</option>
                <option>This Year</option>
              </select>
              <button type="button" style={{ height: 42, padding: '0 20px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 950, cursor: 'pointer' }} onClick={() => alert('Generating report…')}>Generate Report</button>
            </div>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 950 }}>Bulk Actions</h3>
            <p style={{ color: '#66708d', fontSize: 14, marginBottom: 16 }}>Select items in the content list to enable bulk actions.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Publish All', 'Unpublish All', 'Archive Selected', 'Delete Selected', 'Export Selected'].map(a => (
                <button key={a} type="button" style={{ height: 40, padding: '0 16px', border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 750, cursor: 'pointer' }} onClick={() => alert(a)}>{a}</button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 950 }}>Audit Log</h3>
            {[
              { event: 'Content published', item: 'Campaign Update', time: '2 hours ago', color: '#19b86a' },
              { event: 'Content archived', item: 'Blog Post', time: '1 day ago', color: '#8c9ab5' },
              { event: 'Content deleted', item: 'News Article', time: '2 days ago', color: '#ff3b5f' },
              { event: 'Content created', item: 'Campaign Update', time: '3 days ago', color: '#6c35ff' },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#26335c', fontWeight: 700 }}>{e.event}: <em style={{ fontStyle: 'normal', color: '#8c9ab5' }}>{e.item}</em></span>
                <span style={{ color: '#8c9ab5' }}>{e.time}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && <ContentDetailPanel item={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CreateContentWizard onClose={() => setShowCreate(false)} />}
    </div>
  );
}
