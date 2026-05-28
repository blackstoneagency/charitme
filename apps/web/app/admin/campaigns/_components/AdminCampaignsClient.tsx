'use client';

import { useMemo, useState, useTransition, useCallback, useRef } from 'react';
import Link from 'next/link';
import { KFIcon } from '../../../../components/KindFundApp';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
export type AdminCampaign = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: string;
  trustStatus: string;
  payoutFrozen: boolean;
  featured: boolean;
  pinned: boolean;
  healthScore: number;
  raisedAmount: number;
  goalAmount: number;
  backerCount: number;
  category: string;
  organizer: string;
  organizerId: string;
  coverImageUrl: string | null;
  deadline: string | null;
  beneficiaryName: string | null;
  createdAt: string;
};

type Donation = {
  id: string;
  amountCents: number;
  message: string;
  anonymous: boolean;
  status: string;
  createdAt: string;
  donorName: string;
};

type Update = {
  id: string;
  title: string;
  body: string;
  aiGenerated: boolean;
  createdAt: string;
  authorName: string;
};

type CreateDraft = {
  title: string;
  category: string;
  goal: string;
  campaignType: string;
  tagline: string;
  description: string;
  deadline: string;
  beneficiaryName: string;
  coverImageUrl: string;
  visibility: string;
  allowUpdates: boolean;
  allowRecurring: boolean;
};

type ConfirmAction = {
  key: string;
  label: string;
  description: string;
  icon: string;
  danger?: boolean;
};

type DetailTab = 'overview' | 'updates' | 'donations' | 'payouts' | 'more';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
const CAMPAIGN_CATEGORIES = ['Medical','Memorial/Funeral','Emergency','Disaster Relief','Education','Animal/Pet','Community','Nonprofit','Sports/Teams','Other'];
const CAMPAIGN_TYPES = ['Individual','Nonprofit','Business'];

const STATUS_LABEL: Record<string, string> = {
  active: 'Published', draft: 'Draft', paused: 'Paused',
  completed: 'Completed', rejected: 'Archived', frozen: 'Frozen',
};
const STATUS_TONE: Record<string, string> = {
  active: 'green', draft: 'gray', paused: 'orange',
  completed: 'blue', rejected: 'red', frozen: 'red',
};

function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}
function pct(raised: number, goal: number): number {
  if (!goal) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}

// ─────────────────────────────────────────────────────────
// Status Pill
// ─────────────────────────────────────────────────────────
function SPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'gray';
  const label = STATUS_LABEL[status] ?? status;
  return <span className={`ac-spill ${tone}`}>{label}</span>;
}

// ─────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────
type Props = { campaigns: AdminCampaign[] };

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────
export default function AdminCampaignsClient({ campaigns: initialCampaigns }: Props) {
  // ── Core state
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'submitted' | 'live'>('list');
  const [selected, setSelected] = useState<AdminCampaign | null>(null);
  const [notice, setNotice] = useState('');
  const [isPending, startTransition] = useTransition();

  // ── List state
  const [query, setQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [page, setPage] = useState(1);

  // ── Detail state
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showActions, setShowActions] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [loadingTab, setLoadingTab] = useState(false);
  const [newUpdateText, setNewUpdateText] = useState('');
  const [newUpdateTitle, setNewUpdateTitle] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);

  // ── Create wizard state
  const [createStep, setCreateStep] = useState(1);
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    title: '', category: 'Medical', goal: '', campaignType: 'Individual',
    tagline: '', description: '', deadline: '', beneficiaryName: '',
    coverImageUrl: '', visibility: 'Public', allowUpdates: true, allowRecurring: false,
  });
  const [createError, setCreateError] = useState('');
  const [createdCampaign, setCreatedCampaign] = useState<AdminCampaign | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived counts for tabs
  const counts = useMemo(() => ({
    all: campaigns.length,
    active: campaigns.filter(c => c.status === 'active').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
    rejected: campaigns.filter(c => c.status === 'rejected').length,
  }), [campaigns]);

  // ── Filtered + paginated
  const filtered = useMemo(() => campaigns.filter(c => {
    const text = `${c.title} ${c.organizer} ${c.category}`.toLowerCase();
    const matchQuery = text.includes(query.toLowerCase());
    const matchTab = statusTab === 'all' || c.status === statusTab;
    return matchQuery && matchTab;
  }), [campaigns, query, statusTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────
  function openDetail(c: AdminCampaign) {
    setSelected(c);
    setView('detail');
    setActiveTab('overview');
    setShowActions(false);
    setDonations(null);
    setUpdates(null);
    setNotice('');
  }

  function backToList() {
    setView('list');
    setSelected(null);
    setShowActions(false);
    setConfirmAction(null);
    setNotice('');
  }

  const loadTab = useCallback(async (tab: DetailTab, campaignId: string) => {
    setActiveTab(tab);
    setShowActions(false);
    if (tab === 'donations' && !donations) {
      setLoadingTab(true);
      try {
        const res = await fetch(`/api/admin/campaigns/${campaignId}/donations`);
        if (res.ok) setDonations(await res.json() as Donation[]);
      } finally { setLoadingTab(false); }
    }
    if (tab === 'updates' && !updates) {
      setLoadingTab(true);
      try {
        const res = await fetch(`/api/admin/campaigns/${campaignId}/updates`);
        if (res.ok) setUpdates(await res.json() as Update[]);
      } finally { setLoadingTab(false); }
    }
  }, [donations, updates]);

  function patchCampaign(patch: Record<string, unknown>, optimistic?: Partial<AdminCampaign>) {
    if (!selected) return;
    const id = selected.id;
    if (optimistic) {
      const updated = { ...selected, ...optimistic };
      setSelected(updated);
      setCampaigns(cs => cs.map(c => c.id === id ? updated : c));
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const result = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setNotice(result.error ?? 'Update failed.');
        // Revert
        if (optimistic && selected) {
          setSelected(selected);
          setCampaigns(cs => cs.map(c => c.id === id ? selected : c));
        }
      } else {
        setNotice('Campaign updated successfully.');
        setTimeout(() => setNotice(''), 3000);
      }
    });
  }

  function requestConfirm(action: ConfirmAction) {
    setShowActions(false);
    setConfirmAction(action);
  }

  async function executeAction(key: string) {
    if (!selected) return;
    setConfirmAction(null);

    if (key === 'delete') {
      startTransition(async () => {
        const res = await fetch(`/api/admin/campaigns/${selected.id}`, { method: 'DELETE' });
        if (res.ok) {
          setCampaigns(cs => cs.filter(c => c.id !== selected.id));
          backToList();
        } else {
          const r = await res.json().catch(() => ({})) as { error?: string };
          setNotice(r.error ?? 'Delete failed.');
        }
      });
      return;
    }

    if (key === 'duplicate') {
      startTransition(async () => {
        const res = await fetch('/api/admin/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${selected.title} (Copy)`,
            description: selected.description,
            tagline: selected.tagline,
            category: selected.category,
            goalAmount: selected.goalAmount,
            status: 'draft',
            beneficiaryName: selected.beneficiaryName,
            coverImageUrl: selected.coverImageUrl,
          }),
        });
        if (res.ok) {
          const { campaign } = await res.json() as { campaign: { id: string; slug: string; title: string; status: string } };
          const newC: AdminCampaign = {
            ...selected,
            id: campaign.id,
            slug: campaign.slug,
            title: campaign.title,
            status: 'draft',
            raisedAmount: 0,
            backerCount: 0,
            createdAt: new Date().toISOString(),
          };
          setCampaigns(cs => [newC, ...cs]);
          setNotice('Campaign duplicated as draft.');
          setTimeout(() => setNotice(''), 3000);
        }
      });
      return;
    }

    const patchMap: Record<string, { patch: Record<string, unknown>; optimistic: Partial<AdminCampaign> }> = {
      approve:   { patch: { status: 'active', trust_status: 'Verified' }, optimistic: { status: 'active', trustStatus: 'Verified' } },
      publish:   { patch: { status: 'active' }, optimistic: { status: 'active' } },
      unpublish: { patch: { status: 'paused' }, optimistic: { status: 'paused' } },
      archive:   { patch: { status: 'rejected' }, optimistic: { status: 'rejected' } },
    };
    const mapped = patchMap[key];
    if (mapped) patchCampaign(mapped.patch, mapped.optimistic);
  }

  async function postUpdate() {
    if (!selected || !newUpdateText.trim()) return;
    setPostingUpdate(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${selected.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newUpdateTitle.trim() || null, body: newUpdateText.trim() }),
      });
      if (res.ok) {
        const { update } = await res.json() as { update: { id: string; title: string; body: string; ai_generated: boolean; created_at: string } };
        const newU: Update = {
          id: update.id, title: update.title ?? '', body: update.body,
          aiGenerated: update.ai_generated, createdAt: update.created_at, authorName: 'Admin',
        };
        setUpdates(prev => [newU, ...(prev ?? [])]);
        setNewUpdateText('');
        setNewUpdateTitle('');
      }
    } finally { setPostingUpdate(false); }
  }

  async function submitCreate() {
    setCreateError('');
    const goalCents = Math.round((parseFloat(createDraft.goal) || 0) * 100);
    if (createDraft.title.trim().length < 3) { setCreateError('Title must be at least 3 characters.'); return; }
    if (goalCents < 100) { setCreateError('Goal must be at least $1.00.'); return; }
    if (createDraft.description.trim().length < 10) { setCreateError('Description must be at least 10 characters.'); return; }

    startTransition(async () => {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createDraft.title.trim(),
          tagline: createDraft.tagline.trim() || undefined,
          description: createDraft.description.trim(),
          category: createDraft.category,
          goalAmount: goalCents,
          deadline: createDraft.deadline || null,
          status: 'active',
          beneficiaryName: createDraft.beneficiaryName.trim() || undefined,
          coverImageUrl: createDraft.coverImageUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; campaign?: { id: string; slug: string; title: string; status: string } };
      if (!res.ok) { setCreateError(data.error ?? 'Could not create campaign.'); return; }
      const nc: AdminCampaign = {
        id: data.campaign!.id,
        slug: data.campaign!.slug,
        title: createDraft.title.trim(),
        tagline: createDraft.tagline,
        description: createDraft.description,
        status: 'active',
        trustStatus: 'Under Review',
        payoutFrozen: false,
        featured: false,
        pinned: false,
        healthScore: 50,
        raisedAmount: 0,
        goalAmount: goalCents,
        backerCount: 0,
        category: createDraft.category,
        organizer: 'Admin',
        organizerId: '',
        coverImageUrl: createDraft.coverImageUrl || null,
        deadline: createDraft.deadline || null,
        beneficiaryName: createDraft.beneficiaryName || null,
        createdAt: new Date().toISOString(),
      };
      setCampaigns(cs => [nc, ...cs]);
      setCreatedCampaign(nc);
      setView('live');
    });
  }

  function resetCreate() {
    setCreateStep(1);
    setCreateDraft({
      title: '', category: 'Medical', goal: '', campaignType: 'Individual',
      tagline: '', description: '', deadline: '', beneficiaryName: '',
      coverImageUrl: '', visibility: 'Public', allowUpdates: true, allowRecurring: false,
    });
    setCreateError('');
    setCreatedCampaign(null);
  }

  function upd<K extends keyof CreateDraft>(k: K, v: CreateDraft[K]) {
    setCreateDraft(p => ({ ...p, [k]: v }));
  }

  // ─────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────
  // ── VIEW: LIST
  // ─────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="ac-wrap">
      {/* Header */}
      <div className="ac-list-head">
        <h2>Campaigns</h2>
        <button className="ac-btn-new" onClick={() => { resetCreate(); setView('create'); }}>
          <KFIcon name="plus" /> New Campaign
        </button>
      </div>

      {/* Status tabs */}
      <div className="ac-status-tabs">
        {[
          { key: 'all', label: `All (${counts.all})` },
          { key: 'active', label: `Published (${counts.active})` },
          { key: 'draft', label: `Draft (${counts.draft})` },
          { key: 'paused', label: `Paused (${counts.paused})` },
          { key: 'rejected', label: `Archived (${counts.rejected})` },
        ].map(t => (
          <button
            key={t.key}
            className={`ac-stab${statusTab === t.key ? ' active' : ''}`}
            onClick={() => { setStatusTab(t.key); setPage(1); }}
          >{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <div className="ac-toolbar">
        <label className="ac-search">
          <KFIcon name="search" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search campaigns..."
          />
        </label>
        <span className="ac-count">{filtered.length} campaign{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="ac-table-wrap">
        <div className="ac-table-head">
          <span>Campaign</span>
          <span>Creator</span>
          <span>Raised</span>
          <span>Donors</span>
          <span>Status</span>
          <span>Created</span>
        </div>
        {paginated.length === 0 && (
          <div className="ac-empty">No campaigns match the current filters.</div>
        )}
        {paginated.map(c => (
          <button key={c.id} className="ac-row" onClick={() => openDetail(c)}>
            {/* Campaign cell */}
            <span className="ac-cell-campaign">
              <div className="ac-thumb" style={c.coverImageUrl ? { backgroundImage: `url(${c.coverImageUrl})` } : {}}>
                {!c.coverImageUrl && <KFIcon name="stack" />}
              </div>
              <div>
                <strong>{c.title}</strong>
                <small>by {c.organizer}</small>
              </div>
            </span>
            <span className="ac-cell">{c.organizer}</span>
            <span className="ac-cell"><b>{fmtCents(c.raisedAmount)}</b></span>
            <span className="ac-cell">{c.backerCount.toLocaleString()}</span>
            <span className="ac-cell"><SPill status={c.status} /></span>
            <span className="ac-cell ac-date">{fmtDate(c.createdAt)}</span>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ac-pagination">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} campaigns</span>
          <div className="ac-pages">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = i + 1;
              return (
                <button key={pg} className={page === pg ? 'active' : ''} onClick={() => setPage(pg)}>{pg}</button>
              );
            })}
            {totalPages > 7 && <span>…</span>}
            {totalPages > 7 && (
              <button className={page === totalPages ? 'active' : ''} onClick={() => setPage(totalPages)}>{totalPages}</button>
            )}
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────
  // ── VIEW: DETAIL
  // ─────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const days = daysLeft(selected.deadline);
    const progress = pct(selected.raisedAmount, selected.goalAmount);

    return (
      <div className="ac-wrap">
        {/* Detail header */}
        <div className="ac-detail-head">
          <button className="ac-back" onClick={backToList}>
            <KFIcon name="home" /> <span>Campaigns</span>
          </button>
          <div className="ac-detail-title">
            <h2>{selected.title}</h2>
            <SPill status={selected.status} />
          </div>
          <span className="ac-created">Created {fmtDate(selected.createdAt)}</span>
        </div>

        {/* Notice */}
        {notice && (
          <div className={`ac-notice${notice.toLowerCase().includes('fail') || notice.toLowerCase().includes('error') ? ' error' : ''}`}>
            {notice}
          </div>
        )}

        {/* Tabs */}
        <div className="ac-tabs">
          {(['overview', 'updates', 'donations', 'payouts', 'more'] as DetailTab[]).map(tab => (
            <button
              key={tab}
              className={`ac-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => void loadTab(tab, selected.id)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'updates' && updates !== null && <em>{updates.length}</em>}
              {tab === 'donations' && donations !== null && <em>{donations.length}</em>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="ac-detail-body">
          {loadingTab && <div className="ac-loading">Loading…</div>}

          {/* ── Overview ── */}
          {!loadingTab && activeTab === 'overview' && (
            <div className="ac-overview">
              {/* Left: cover + stats */}
              <div className="ac-ov-left">
                <div
                  className="ac-cover"
                  style={selected.coverImageUrl ? { backgroundImage: `url(${selected.coverImageUrl})` } : {}}
                >
                  {!selected.coverImageUrl && <KFIcon name="stack" />}
                </div>
                <div className="ac-ov-stats">
                  <div className="ac-raised-row">
                    <strong>{fmtCents(selected.raisedAmount)}</strong>
                    <span>Raised of {fmtCents(selected.goalAmount)} goal</span>
                  </div>
                  <div className="ac-progress-bar">
                    <div className="ac-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="ac-stat-row">
                    <div className="ac-stat"><b>{selected.backerCount.toLocaleString()}</b><span>Total Donors</span></div>
                    {days !== null && <div className="ac-stat"><b>{days}</b><span>Days Left</span></div>}
                    <div className="ac-stat"><b>{progress}%</b><span>Funded</span></div>
                  </div>
                </div>
              </div>
              {/* Right: details */}
              <div className="ac-ov-right">
                <div className="ac-details-grid">
                  <span>Category</span><span>{selected.category}</span>
                  <span>Campaign Type</span><span>{selected.trustStatus}</span>
                  <span>Organizer</span><span>{selected.organizer}</span>
                  {selected.beneficiaryName && <><span>Beneficiary</span><span>{selected.beneficiaryName}</span></>}
                  {selected.deadline && <><span>Deadline</span><span>{fmtDate(selected.deadline)}</span></>}
                  <span>Health Score</span>
                  <span>
                    <span className={`ac-health ${selected.healthScore >= 70 ? 'good' : selected.healthScore >= 40 ? 'warn' : 'bad'}`}>
                      {selected.healthScore}/100
                    </span>
                  </span>
                  <span>Payouts</span><span>{selected.payoutFrozen ? '🔒 Frozen' : '✓ Open'}</span>
                  {selected.featured && <><span>Featured</span><span>⭐ Yes</span></>}
                  {selected.pinned && <><span>Pinned</span><span>📌 Yes</span></>}
                </div>
                {selected.description && (
                  <div className="ac-desc-block">
                    <label>Description</label>
                    <p>{selected.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Updates ── */}
          {!loadingTab && activeTab === 'updates' && (
            <div className="ac-tab-pane">
              <div className="ac-update-compose">
                <h3>Post an Update</h3>
                <input
                  placeholder="Update title (optional)"
                  value={newUpdateTitle}
                  onChange={e => setNewUpdateTitle(e.target.value)}
                  className="ac-input"
                />
                <textarea
                  placeholder="Write an update for donors..."
                  value={newUpdateText}
                  onChange={e => setNewUpdateText(e.target.value)}
                  className="ac-textarea"
                  rows={4}
                />
                <button
                  className="ac-btn-primary"
                  disabled={!newUpdateText.trim() || postingUpdate}
                  onClick={postUpdate}
                >
                  {postingUpdate ? 'Posting…' : 'Post Update'}
                </button>
              </div>
              {updates === null && <div className="ac-loading">Loading updates…</div>}
              {updates !== null && updates.length === 0 && <div className="ac-empty">No updates posted yet.</div>}
              {updates !== null && updates.map(u => (
                <div key={u.id} className="ac-update-card">
                  <div className="ac-update-meta">
                    <strong>{u.title || 'Update'}</strong>
                    <span>{fmtDate(u.createdAt)} · by {u.authorName}</span>
                    {u.aiGenerated && <em className="ac-ai-badge">AI</em>}
                  </div>
                  <p>{u.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Donations ── */}
          {!loadingTab && activeTab === 'donations' && (
            <div className="ac-tab-pane">
              {donations === null && <div className="ac-loading">Loading donations…</div>}
              {donations !== null && donations.length === 0 && <div className="ac-empty">No donations yet.</div>}
              {donations !== null && donations.length > 0 && (
                <>
                  <div className="ac-don-head">
                    <span>Donor</span><span>Amount</span><span>Message</span><span>Status</span><span>Date</span>
                  </div>
                  {donations.map(d => (
                    <div key={d.id} className="ac-don-row">
                      <span>{d.donorName}</span>
                      <b>{fmtCents(d.amountCents)}</b>
                      <span className="ac-msg">{d.message || '—'}</span>
                      <SPill status={d.status} />
                      <span className="ac-date">{fmtDate(d.createdAt)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Payouts ── */}
          {!loadingTab && activeTab === 'payouts' && (
            <div className="ac-tab-pane">
              <div className="ac-payout-status">
                <div className={`ac-payout-badge ${selected.payoutFrozen ? 'frozen' : 'open'}`}>
                  {selected.payoutFrozen ? '🔒 Payouts Frozen' : '✓ Payouts Open'}
                </div>
                <p>{selected.payoutFrozen
                  ? 'Payouts are currently frozen for this campaign pending review.'
                  : 'Payouts are enabled. Funds can be transferred to the organizer.'
                }</p>
                <div className="ac-payout-actions">
                  <button
                    className={selected.payoutFrozen ? 'ac-btn-primary' : 'ac-btn-danger'}
                    disabled={isPending}
                    onClick={() => patchCampaign(
                      { payout_frozen: !selected.payoutFrozen },
                      { payoutFrozen: !selected.payoutFrozen },
                    )}
                  >
                    {selected.payoutFrozen ? 'Unfreeze Payouts' : 'Freeze Payouts'}
                  </button>
                </div>
              </div>
              <div className="ac-payout-summary">
                <div className="ac-pstat"><span>Total Raised</span><b>{fmtCents(selected.raisedAmount)}</b></div>
                <div className="ac-pstat"><span>Goal</span><b>{fmtCents(selected.goalAmount)}</b></div>
                <div className="ac-pstat"><span>Progress</span><b>{progress}%</b></div>
              </div>
            </div>
          )}

          {/* ── More (edit) ── */}
          {!loadingTab && activeTab === 'more' && (
            <div className="ac-tab-pane ac-edit-form">
              <h3>Edit Campaign</h3>
              <EditForm campaign={selected} onSave={(patch, optimistic) => patchCampaign(patch, optimistic)} isPending={isPending} />
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="ac-action-bar">
          <Link
            href={`/campaigns/${selected.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ac-btn-outline"
          >
            View Public Page ↗
          </Link>
          <button className="ac-btn-actions" onClick={() => setShowActions(s => !s)}>
            More Actions <KFIcon name="filter" />
          </button>
        </div>

        {/* More Actions panel */}
        {showActions && (
          <div className="ac-actions-panel">
            <div className="ac-actions-head">
              <strong>More Actions</strong>
              <button onClick={() => setShowActions(false)}>✕</button>
            </div>
            <ActionItem icon="doc" label="Edit Campaign" onClick={() => { setShowActions(false); loadTab('more', selected.id); }} />
            <ActionItem icon="check" label="Approve Campaign" onClick={() => requestConfirm({
              key: 'approve', label: 'Approve Campaign',
              description: 'Approve this campaign? It will be visible to all users once approved.',
              icon: 'check',
            })} />
            <ActionItem icon="send" label="Publish Campaign" onClick={() => requestConfirm({
              key: 'publish', label: 'Publish Campaign',
              description: 'Set this campaign to active and make it visible to donors.',
              icon: 'send',
            })} />
            <ActionItem icon="bell" label="Unpublish Campaign" onClick={() => requestConfirm({
              key: 'unpublish', label: 'Unpublish Campaign',
              description: 'Pause this campaign. It will no longer appear to donors.',
              icon: 'bell',
            })} />
            <div className="ac-action-toggle">
              <ActionItem icon="crown" label="Feature Campaign" onClick={() => {}} />
              <label className="ac-toggle">
                <input
                  type="checkbox"
                  checked={selected.featured}
                  onChange={e => patchCampaign({ featured: e.target.checked }, { featured: e.target.checked })}
                />
                <span />
              </label>
            </div>
            <div className="ac-action-toggle">
              <ActionItem icon="link" label="Pin to Homepage" onClick={() => {}} />
              <label className="ac-toggle">
                <input
                  type="checkbox"
                  checked={selected.pinned}
                  onChange={e => patchCampaign({ pinned: e.target.checked }, { pinned: e.target.checked })}
                />
                <span />
              </label>
            </div>
            <hr className="ac-divider" />
            <ActionItem icon="stack" label="Duplicate Campaign" onClick={() => requestConfirm({
              key: 'duplicate', label: 'Duplicate Campaign',
              description: 'Create a copy of this campaign as a new draft.',
              icon: 'stack',
            })} />
            <ActionItem icon="audit" label="Archive Campaign" onClick={() => requestConfirm({
              key: 'archive', label: 'Archive Campaign',
              description: 'Archive this campaign. It will no longer be active.',
              icon: 'audit',
            })} />
            <ActionItem icon="logout" label="Delete Campaign" danger onClick={() => requestConfirm({
              key: 'delete', label: 'Delete Campaign',
              description: 'Permanently delete this campaign and all associated data. This cannot be undone.',
              icon: 'logout', danger: true,
            })} />
          </div>
        )}

        {/* Confirm modal */}
        {confirmAction && (
          <div className="ac-modal-overlay" onClick={() => setConfirmAction(null)}>
            <div className="ac-modal" onClick={e => e.stopPropagation()}>
              <button className="ac-modal-close" onClick={() => setConfirmAction(null)}>✕</button>
              <div className={`ac-modal-icon ${confirmAction.danger ? 'danger' : 'primary'}`}>
                <KFIcon name={confirmAction.icon} />
              </div>
              <h3>{confirmAction.label}</h3>
              <p>{confirmAction.description}</p>
              <div className="ac-modal-btns">
                <button className="ac-btn-outline" onClick={() => setConfirmAction(null)}>Cancel</button>
                <button
                  className={confirmAction.danger ? 'ac-btn-danger' : 'ac-btn-primary'}
                  disabled={isPending}
                  onClick={() => void executeAction(confirmAction.key)}
                >
                  {isPending ? 'Working…' : confirmAction.label}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // ── VIEW: CREATE WIZARD
  // ─────────────────────────────────────────────────────
  if (view === 'create') return (
    <div className="ac-wrap">
      <div className="ac-create-head">
        <button className="ac-back" onClick={backToList}><KFIcon name="home" /> <span>Campaigns</span></button>
        <h2>New Campaign</h2>
      </div>

      {/* Step indicator */}
      <div className="ac-step-track">
        {['Details', 'Story', 'Media', 'Settings'].map((label, i) => {
          const num = i + 1;
          const done = num < createStep;
          const active = num === createStep;
          return (
            <div key={label} className={`ac-step${active ? ' active' : done ? ' done' : ''}`}>
              <span className="ac-step-num">{done ? '✓' : num}</span>
              {label}
            </div>
          );
        })}
      </div>

      <div className="ac-create-body kf-card">
        {createError && <div className="ac-notice error">{createError}</div>}

        {/* Step 1: Details */}
        {createStep === 1 && (
          <div className="ac-form-grid">
            <div className="ac-field full">
              <label>Campaign Title *</label>
              <input className="ac-input" value={createDraft.title} onChange={e => upd('title', e.target.value)} placeholder="e.g. Help Sarah cover emergency medical bills" maxLength={100} />
            </div>
            <div className="ac-field">
              <label>Category</label>
              <select className="ac-input" value={createDraft.category} onChange={e => upd('category', e.target.value)}>
                {CAMPAIGN_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="ac-field">
              <label>Campaign Type</label>
              <select className="ac-input" value={createDraft.campaignType} onChange={e => upd('campaignType', e.target.value)}>
                {CAMPAIGN_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="ac-field">
              <label>Goal Amount (USD) *</label>
              <input className="ac-input" type="number" min="1" value={createDraft.goal} onChange={e => upd('goal', e.target.value)} placeholder="25000" />
            </div>
            <div className="ac-field">
              <label>Beneficiary Name</label>
              <input className="ac-input" value={createDraft.beneficiaryName} onChange={e => upd('beneficiaryName', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="ac-create-nav">
              <button className="ac-btn-outline" onClick={backToList}>Cancel</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="ac-btn-ghost" onClick={() => { setCreateStep(2); }}>Save as Draft</button>
                <button className="ac-btn-primary" onClick={() => {
                  if (createDraft.title.trim().length < 3) { setCreateError('Title must be at least 3 characters.'); return; }
                  if (!createDraft.goal || parseFloat(createDraft.goal) < 1) { setCreateError('Enter a valid goal amount.'); return; }
                  setCreateError(''); setCreateStep(2);
                }}>Continue</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Story */}
        {createStep === 2 && (
          <div className="ac-form-grid">
            <div className="ac-field full">
              <label>Short Tagline</label>
              <input className="ac-input" value={createDraft.tagline} onChange={e => upd('tagline', e.target.value)} placeholder="A clear, emotional summary of your need" maxLength={160} />
            </div>
            <div className="ac-field full">
              <label>Full Story *</label>
              <textarea className="ac-textarea" rows={8} value={createDraft.description} onChange={e => upd('description', e.target.value)} placeholder={'Who needs help? What happened? Why now?\nHow will the funds be used?'} />
            </div>
            <div className="ac-field">
              <label>End Date (optional)</label>
              <input className="ac-input" type="date" value={createDraft.deadline} onChange={e => upd('deadline', e.target.value)} />
            </div>
            <div className="ac-create-nav">
              <button className="ac-btn-ghost" onClick={() => setCreateStep(1)}>Back</button>
              <button className="ac-btn-primary" onClick={() => {
                if (createDraft.description.trim().length < 10) { setCreateError('Story must be at least 10 characters.'); return; }
                setCreateError(''); setCreateStep(3);
              }}>Continue</button>
            </div>
          </div>
        )}

        {/* Step 3: Media */}
        {createStep === 3 && (
          <div className="ac-form-grid">
            <div className="ac-field full">
              <label>Cover Image URL</label>
              <input
                className="ac-input"
                value={createDraft.coverImageUrl}
                onChange={e => upd('coverImageUrl', e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  const res = await fetch('/api/upload/campaign-image', { method: 'POST', body: fd });
                  if (res.ok) {
                    const data = await res.json() as { url?: string };
                    if (data.url) upd('coverImageUrl', data.url);
                  }
                }}
              />
            </div>
            {createDraft.coverImageUrl && (
              <div className="ac-field full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={createDraft.coverImageUrl} alt="Cover preview" className="ac-cover-preview" />
              </div>
            )}
            <div className="ac-field full">
              <button className="ac-btn-outline" style={{ width: '100%' }} onClick={() => fileInputRef.current?.click()}>
                <KFIcon name="upload" /> Upload Cover Photo
              </button>
            </div>
            <div className="ac-create-nav">
              <button className="ac-btn-ghost" onClick={() => setCreateStep(2)}>Back</button>
              <button className="ac-btn-primary" onClick={() => { setCreateError(''); setCreateStep(4); }}>Continue</button>
            </div>
          </div>
        )}

        {/* Step 4: Settings */}
        {createStep === 4 && (
          <div className="ac-form-grid">
            <div className="ac-field">
              <label>Visibility</label>
              <select className="ac-input" value={createDraft.visibility} onChange={e => upd('visibility', e.target.value)}>
                <option>Public</option>
                <option>Private</option>
              </select>
            </div>
            <div className="ac-field">
              <label>Payout Account</label>
              <select className="ac-input">
                <option>Default (Admin)</option>
              </select>
            </div>
            <div className="ac-field full">
              <label className="ac-check-label">
                <input type="checkbox" checked={createDraft.allowUpdates} onChange={e => upd('allowUpdates', e.target.checked)} />
                Allow organizer to post updates
              </label>
            </div>
            <div className="ac-field full">
              <label className="ac-check-label">
                <input type="checkbox" checked={createDraft.allowRecurring} onChange={e => upd('allowRecurring', e.target.checked)} />
                Allow recurring donations
              </label>
            </div>
            <div className="ac-create-nav">
              <button className="ac-btn-ghost" onClick={() => setCreateStep(3)}>Back</button>
              <button className="ac-btn-primary" disabled={isPending} onClick={() => void submitCreate()}>
                {isPending ? 'Creating…' : 'Review & Submit'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Journey bar */}
      <div className="ac-journey">
        {['Plan','Create','Launch','Manage','Celebrate','Impact'].map((s, i) => (
          <div key={s} className={`ac-ji${i <= 1 ? ' done' : i === 2 ? ' active' : ''}`}>
            <div className="ac-ji-dot" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────
  // ── VIEW: LIVE (Campaign Created Successfully)
  // ─────────────────────────────────────────────────────
  if (view === 'live' && createdCampaign) return (
    <div className="ac-wrap">
      <div className="ac-live-layout">
        {/* Left: campaign card */}
        <div className="ac-live-card kf-card">
          <div className="ac-live-cover" style={createdCampaign.coverImageUrl ? { backgroundImage: `url(${createdCampaign.coverImageUrl})` } : {}} />
          <div className="ac-live-info">
            <SPill status={createdCampaign.status} />
            <h3>{createdCampaign.title}</h3>
            <p>by {createdCampaign.organizer}</p>
            <div className="ac-progress-bar" style={{ margin: '12px 0 8px' }}>
              <div className="ac-progress-fill" style={{ width: '0%' }} />
            </div>
            <div className="ac-live-stats">
              <span>{fmtCents(0)} raised of {fmtCents(createdCampaign.goalAmount)} goal</span>
            </div>
            <div className="ac-live-footer">
              <div><b>0</b><span>Donors</span></div>
              {createdCampaign.deadline && <div><b>{daysLeft(createdCampaign.deadline) ?? '—'}</b><span>Days Left</span></div>}
            </div>
          </div>
          <div className="ac-live-actions">
            <Link href={`/campaigns/${createdCampaign.slug}`} target="_blank" className="ac-btn-outline" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              View Campaign ↗
            </Link>
          </div>
        </div>

        {/* Right: success */}
        <div className="ac-success-panel kf-card">
          <div className="ac-success-icon">
            <KFIcon name="check" />
          </div>
          <h2>Campaign Live!</h2>
          <p>The campaign has been created and is now live. Share it to start receiving donations.</p>
          <div className="ac-success-btns">
            <button className="ac-btn-primary" onClick={() => openDetail(createdCampaign)}>
              Manage Campaign
            </button>
            <button className="ac-btn-ghost" onClick={() => { resetCreate(); backToList(); }}>
              Back to Campaigns
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────
function ActionItem({ icon, label, danger, onClick }: { icon: string; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className={`ac-action-item${danger ? ' danger' : ''}`} onClick={onClick}>
      <KFIcon name={icon} />
      {label}
    </button>
  );
}

function EditForm({
  campaign,
  onSave,
  isPending,
}: {
  campaign: AdminCampaign;
  onSave: (patch: Record<string, unknown>, optimistic: Partial<AdminCampaign>) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState(campaign);
  const changed = JSON.stringify(draft) !== JSON.stringify(campaign);

  function upd<K extends keyof AdminCampaign>(k: K, v: AdminCampaign[K]) {
    setDraft(p => ({ ...p, [k]: v }));
  }

  function save() {
    onSave({
      title: draft.title,
      tagline: draft.tagline,
      description: draft.description,
      category: draft.category,
      status: draft.status,
      trust_status: draft.trustStatus,
      payout_frozen: draft.payoutFrozen,
      campaign_health_score: draft.healthScore,
      goal_amount: draft.goalAmount,
    }, draft);
  }

  return (
    <div className="ac-form-grid">
      <div className="ac-field full"><label>Title</label><input className="ac-input" value={draft.title} onChange={e => upd('title', e.target.value)} /></div>
      <div className="ac-field"><label>Category</label><input className="ac-input" value={draft.category} onChange={e => upd('category', e.target.value)} /></div>
      <div className="ac-field"><label>Status</label>
        <select className="ac-input" value={draft.status} onChange={e => upd('status', e.target.value)}>
          {['draft','active','paused','completed','rejected','frozen'].map(s => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
        </select>
      </div>
      <div className="ac-field"><label>Trust Status</label>
        <select className="ac-input" value={draft.trustStatus} onChange={e => upd('trustStatus', e.target.value)}>
          {['Needs More Info','Under Review','Verified','Flagged'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="ac-field"><label>Goal Amount ($)</label><input className="ac-input" type="number" min={0} value={Math.round(draft.goalAmount / 100)} onChange={e => upd('goalAmount', Number(e.target.value) * 100)} /></div>
      <div className="ac-field"><label>Health Score (0–100)</label><input className="ac-input" type="number" min={0} max={100} value={draft.healthScore} onChange={e => upd('healthScore', Number(e.target.value))} /></div>
      <div className="ac-field full">
        <label className="ac-check-label"><input type="checkbox" checked={draft.payoutFrozen} onChange={e => upd('payoutFrozen', e.target.checked)} /> Freeze payouts for review</label>
      </div>
      <div className="ac-field full"><label>Tagline</label><input className="ac-input" value={draft.tagline} onChange={e => upd('tagline', e.target.value)} /></div>
      <div className="ac-field full"><label>Description</label><textarea className="ac-textarea" rows={5} value={draft.description} onChange={e => upd('description', e.target.value)} /></div>
      <div className="ac-field full">
        <button className="ac-btn-primary" disabled={!changed || isPending} onClick={save}>
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
