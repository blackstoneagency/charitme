'use client';

import React, { useState, useMemo, useCallback } from 'react';

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
  campaign_id?: string;
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
    : s.includes('ai') ? 'blue' : 'violet';
  const colors: Record<string, { bg: string; color: string }> = {
    green: { bg: '#def7e7', color: '#079447' },
    orange: { bg: '#fff0dc', color: '#f97316' },
    violet: { bg: '#efe8ff', color: '#551cf2' },
    blue: { bg: '#e8f0ff', color: '#2563eb' },
  };
  const c = colors[tone] ?? colors.violet;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      {capitalize(status)}
    </span>
  );
}

// ─────────────────────────────────────────────
// Donut chart
// ─────────────────────────────────────────────
function TypeDonut({ items }: { items: { type: string; count: number }[] }) {
  const colors = ['#6c35ff', '#ec3fb4', '#2f80ed', '#19b86a', '#f59e0b'];
  const total = Math.max(items.reduce((s, x) => s + x.count, 0), 1);
  const r = 56; const cx = 72; const cy = 72;
  const circumference = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg viewBox="0 0 144 144" style={{ width: 110, height: 110, flexShrink: 0 }}>
        {items.map((item, i) => {
          const frac = item.count / total;
          const dash = frac * circumference;
          const offset = items.slice(0, i).reduce((sum, p) => sum + (p.count / total), 0);
          return (
            <circle key={item.type} cx={cx} cy={cy} r={r} fill="none"
              stroke={colors[i % colors.length]} strokeWidth="22"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset * circumference + circumference / 4} />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 11} fill="#fff" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="950" fill="#101944">{total}</text>
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
// Edit Content Modal
// ─────────────────────────────────────────────
function EditModal({ item, onClose, onSaved }: { item: ContentRecord; onClose: () => void; onSaved: (id: string, title: string, body: string) => void }) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!body.trim()) { setError('Content body is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/content/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || null, body: body.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to save.'); return; }
      onSaved(item.id, title.trim(), body.trim());
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,15,60,.38)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 560, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(20,20,80,.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit Content</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5' }}>×</button>
        </div>
        <div style={{ padding: '24px', display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
            Title (optional)
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Update title…" style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
            Content <span style={{ color: '#e11d48' }}>*</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '10px 14px', fontSize: 14, minHeight: 160, resize: 'vertical' }} />
          </label>
          {error && <p style={{ margin: 0, color: '#e11d48', fontSize: 13 }}>{error}</p>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0f7', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 42, padding: '0 20px', border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ height: 42, padding: '0 22px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.65 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Delete Confirm Modal
// ─────────────────────────────────────────────
function DeleteModal({ item, onClose, onDeleted }: { item: ContentRecord; onClose: () => void; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/content/${item.id}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Delete failed.'); return; }
      onDeleted(item.id);
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally { setDeleting(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,15,60,.38)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 420, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 24px 80px rgba(20,20,80,.18)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0f0f30' }}>Delete Content?</h2>
        <p style={{ margin: '0 0 4px', color: '#26335c', fontSize: 14 }}>
          <strong>&ldquo;{item.title || 'Untitled'}&rdquo;</strong>
        </p>
        <p style={{ margin: '0 0 20px', color: '#66708d', fontSize: 13 }}>This will permanently remove the update from the campaign. This action cannot be undone.</p>
        {error && <p style={{ margin: '0 0 12px', color: '#e11d48', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, height: 42, border: 0, borderRadius: 9, background: '#e11d48', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.65 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Content detail panel (slide-in)
// ─────────────────────────────────────────────
function ContentDetailPanel({
  item, onClose, onEdit, onDelete,
}: {
  item: ContentRecord;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const tabs = ['overview', 'content', 'history'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ marginLeft: 'auto', width: 520, maxWidth: '100vw', background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-12px 0 56px rgba(20,20,80,.14)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <StatusPill status={item.status} />
              <span style={{ fontSize: 12, color: '#8c9ab5' }}>Updated {fmtDate(item.updated_at)}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f0f30', lineHeight: 1.3 }}>{item.title || 'Untitled'}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5', flexShrink: 0 }}>×</button>
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
              {[
                ['Type', item.type],
                ['Author', item.author],
                ['Campaign', item.campaign_title],
                ['Status', item.status],
                ['Created', fmtDate(item.created_at)],
                ['Updated', fmtDate(item.updated_at)],
                ['Content ID', item.id.slice(0, 18) + '…'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <span style={{ color: '#66708d', fontWeight: 700 }}>{label}</span>
                  <span style={{ color: '#101944', fontWeight: 600, textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word' }}>{val}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'content' && (
            <div style={{ fontSize: 14, color: '#26335c', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 500, overflowY: 'auto', padding: '16px', background: '#fbf9ff', borderRadius: 10, border: '1px solid #e6e9f2' }}>
              {item.body || 'No content.'}
            </div>
          )}
          {activeTab === 'history' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { event: 'Content created', date: item.created_at, color: '#19b86a' },
                { event: 'Content last updated', date: item.updated_at, color: '#6c35ff' },
              ].map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#101944' }}>{ev.event}</div>
                    <div style={{ fontSize: 12, color: '#8c9ab5', marginTop: 2 }}>{fmtDate(ev.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0f7', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" onClick={onEdit} style={{ height: 40, border: '1px solid #6c35ff', borderRadius: 9, background: '#f3ecff', color: '#551cf2', fontSize: 13, fontWeight: 650, cursor: 'pointer' }}>Edit Content</button>
            <button type="button" onClick={onDelete} style={{ height: 40, border: '1px solid #ff3b5f30', borderRadius: 9, background: '#fff0f3', color: 'var(--red-text)', fontSize: 13, fontWeight: 650, cursor: 'pointer' }}>Delete Content</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create Content Wizard (3 steps)
// ─────────────────────────────────────────────
function CreateContentWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (rec: ContentRecord) => void;
}) {
  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!body.trim()) { setError('Content body is required.'); return; }
    if (!campaignId.trim()) { setError('Campaign ID is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, body: body.trim(), campaignId: campaignId.trim() }),
      });
      const data = await res.json() as { error?: string; update?: { id: string; title: string | null; body: string; created_at: string; updated_at: string; campaign_id: string } };
      if (!res.ok) { setError(data.error ?? 'Failed to create content.'); return; }
      const u = data.update!;
      onCreated({
        id: u.id,
        title: u.title ?? title.trim(),
        body: u.body,
        type: 'Campaign Update',
        status: 'Published',
        author: 'Admin',
        campaign_title: `Campaign ${u.campaign_id.slice(0, 8)}…`,
        campaign_id: u.campaign_id,
        created_at: u.created_at,
        updated_at: u.updated_at,
      });
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 520, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(20,20,80,.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f0f30' }}>Create Campaign Update</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{ width: 28, height: 4, borderRadius: 2, background: step >= s ? '#6c35ff' : '#e6e9f2' }} />
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5' }}>×</button>
        </div>

        <div style={{ padding: '24px' }}>
          {step === 1 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#101944', marginBottom: 4 }}>Campaign Target</div>
              <p style={{ margin: 0, fontSize: 13, color: '#66708d' }}>Enter the Campaign ID this update belongs to. You can find campaign IDs in Admin → Campaigns.</p>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Campaign ID <span style={{ color: '#e11d48' }}>*</span>
                <input
                  value={campaignId}
                  onChange={e => setCampaignId(e.target.value)}
                  placeholder="e.g. a1b2c3d4-..."
                  style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}
                />
              </label>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#101944', marginBottom: 4 }}>Content Details</div>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Title (optional)
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Update title…" style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Content <span style={{ color: '#e11d48' }}>*</span>
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write the campaign update…" style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '10px 14px', fontSize: 14, minHeight: 140, resize: 'vertical' }} />
              </label>
            </div>
          )}
          {step === 3 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#101944', marginBottom: 4 }}>Review & Publish</div>
              <div style={{ padding: '14px', background: '#fbf9ff', borderRadius: 10, border: '1px solid #e6e9f2', fontSize: 13, lineHeight: 1.8 }}>
                <div><b>Campaign ID:</b> {campaignId}</div>
                <div><b>Title:</b> {title || '(untitled)'}</div>
                <div><b>Content preview:</b> {body.slice(0, 120)}{body.length > 120 ? '…' : ''}</div>
              </div>
              {error && <p style={{ margin: 0, color: '#e11d48', fontSize: 13 }}>{error}</p>}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0f7', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {step > 1 && (
            <button onClick={() => { setStep(s => s - 1); setError(''); }} style={{ height: 42, padding: '0 20px', border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          )}
          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1 && !campaignId.trim()) { setError('Campaign ID is required.'); return; }
                if (step === 2 && !body.trim()) { setError('Content body is required.'); return; }
                setError('');
                setStep(s => s + 1);
              }}
              style={{ height: 42, padding: '0 24px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} style={{ height: 42, padding: '0 24px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.65 : 1 }}>
              {saving ? 'Publishing…' : 'Publish Update'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function ContentClient({
  totalContent: _totalContent, publishedCount, draftCount, aiGeneratedCount, contentByType, content: initialContent,
}: ContentClientProps) {
  const [content, setContent] = useState<ContentRecord[]>(initialContent);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ContentRecord | null>(null);
  const [editItem, setEditItem] = useState<ContentRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<ContentRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState('content');

  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    let list = content;
    if (filterType !== 'all') list = list.filter(c => c.type.toLowerCase() === filterType.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q));
    }
    return list;
  }, [content, filterType, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSaved = useCallback((id: string, newTitle: string, newBody: string) => {
    setContent(prev => prev.map(c => c.id === id ? { ...c, title: newTitle, body: newBody, updated_at: new Date().toISOString() } : c));
    setSelected(prev => prev && prev.id === id ? { ...prev, title: newTitle, body: newBody, updated_at: new Date().toISOString() } : prev);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setContent(prev => prev.filter(c => c.id !== id));
    setSelected(prev => prev?.id === id ? null : prev);
  }, []);

  const handleCreated = useCallback((rec: ContentRecord) => {
    setContent(prev => [rec, ...prev]);
  }, []);

  function openEdit() {
    if (!selected) return;
    setEditItem(selected);
    setSelected(null);
  }

  function openDelete() {
    if (!selected) return;
    setDeleteItem(selected);
    setSelected(null);
  }

  const panelTabs = ['content', 'activity', 'audit'];
  const recentActivity = content.slice(0, 5).map(c => ({ title: c.title || 'Untitled', type: c.type, author: c.author, date: c.updated_at }));

  return (
    <div style={{ padding: '0 32px 40px' }}>
      {/* KPI */}
      <div className="kf-metrics" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Content', value: content.length.toLocaleString(), tone: 'violet', icon: 'doc' },
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
            <div><span>{m.label}</span><strong>{m.value}</strong></div>
          </article>
        ))}
      </div>

      {/* Charts row */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card">
          <div className="kf-card-head"><h2>Content by Type</h2></div>
          <div style={{ padding: '10px 20px 20px' }}>
            <TypeDonut items={contentByType.length > 0 ? contentByType : [{ type: 'Campaign Updates', count: content.length }]} />
          </div>
        </section>
        <section className="kf-card">
          <div className="kf-card-head"><h2>Recent Activity</h2></div>
          <div>
            {recentActivity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 20px', borderBottom: '1px solid #f0f2f8' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c35ff', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#66708d', marginTop: 2 }}>{a.type} · {a.author}</div>
                </div>
                <div style={{ fontSize: 11, color: '#8c9ab5', flexShrink: 0 }}>{fmtDate(a.date)}</div>
              </div>
            ))}
            {recentActivity.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No content yet</div>}
          </div>
        </section>
      </div>

      {/* Main table */}
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
          <button type="button" onClick={() => setShowCreate(true)} style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Create Content
          </button>
        </div>

        {activeTab === 'content' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #eef0f7', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', background: '#fff' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#8c9ab5" strokeWidth={2} width={15} height={15} aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search content…" aria-label="Search content" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, width: '100%' }} />
              </div>
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }} style={{ height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', fontSize: 13, background: '#fff' }}>
                <option value="all">All Types</option>
                {contentByType.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 130px', gap: 12, padding: '10px 20px', background: '#f8f9fc', borderBottom: '1px solid #eef0f7', fontSize: 11, fontWeight: 700, color: '#8c9ab5', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Title</span><span>Type</span><span>Campaign</span><span>Updated</span>
            </div>

            {currentPage.map(c => (
              <div key={c.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 130px', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer', alignItems: 'center' }}
                onClick={() => setSelected(c)}
                onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Untitled'}</div>
                  <div style={{ fontSize: 11, color: '#8c9ab5', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body.slice(0, 70)}{c.body.length > 70 ? '…' : ''}</div>
                </div>
                <span style={{ fontSize: 12, color: '#66708d', fontWeight: 700 }}>{c.type}</span>
                <span style={{ fontSize: 12, color: '#66708d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_title}</span>
                <span style={{ fontSize: 12, color: '#8c9ab5' }}>{fmtDate(c.updated_at)}</span>
              </div>
            ))}

            {currentPage.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No content found</div>}

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
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Content Activity</h3>
            {content.slice(0, 10).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c35ff', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 650, color: '#101944' }}>{c.title || 'Untitled'}</span>
                  <span style={{ color: '#66708d', marginLeft: 6 }}>· {c.campaign_title}</span>
                </div>
                <span style={{ color: '#8c9ab5', flexShrink: 0 }}>{fmtDate(c.updated_at)}</span>
              </div>
            ))}
            {content.length === 0 && <p style={{ color: '#8c9ab5', fontSize: 14 }}>No content yet.</p>}
          </div>
        )}

        {activeTab === 'audit' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Audit Log</h3>
            <p style={{ color: '#66708d', fontSize: 13 }}>Content actions (create, edit, delete) are logged in the platform audit log. View full logs in Admin → Audit Log, filtering by target type &ldquo;campaign_update&rdquo;.</p>
          </div>
        )}
      </section>

      {/* Modals */}
      {selected && (
        <ContentDetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      )}
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={handleSaved}
        />
      )}
      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDeleted={handleDeleted}
        />
      )}
      {showCreate && (
        <CreateContentWizard
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
