'use client';

import React, { useEffect, useMemo, useState, useTransition, useCallback, useRef } from 'react';
import Link from 'next/link';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { KFIcon } from '../../../../components/CharitMeApp';
import SupportersPanel from '../../../dashboard/campaigns/[id]/_components/SupportersPanel';
import SharePanel from '../../../dashboard/campaigns/[id]/_components/SharePanel';
import ThankDonorsPanel from '../../../dashboard/campaigns/[id]/_components/ThankDonorsPanel';
import LedgerPanel from '../../../dashboard/campaigns/[id]/_components/LedgerPanel';
import FaqsPanel from '../../../dashboard/campaigns/[id]/_components/FaqsPanel';
import AdminNotesPanel from '../../../../components/AdminNotesPanel';
import EditCampaignPanel from '../../../dashboard/campaigns/[id]/_components/EditCampaignPanel';
import UpdatesPanel from '../../../dashboard/campaigns/[id]/_components/UpdatesPanel';
import AnalyticsPanel from '../../../dashboard/campaigns/[id]/_components/AnalyticsPanel';
import SettingsPanel from '../../../dashboard/campaigns/[id]/_components/SettingsPanel';
import { QrPosterPanel } from '../../../dashboard/campaigns/[id]/_components/CampaignWorkspace';
import { campaignDaysLeft, campaignTimeLabel } from '../../../../lib/campaign-lifecycle';

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
  imageUrls: string[];
  videoUrl: string | null;
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

type DetailTab =
  | 'supporters' | 'share' | 'thank-donors' | 'ledger' | 'faqs' | 'qr-poster'
  | 'post-update' | 'analytics' | 'settings' | 'edit'
  | 'overview' | 'donations' | 'payouts' | 'more' | 'notes';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
// Imported rather than re-listed: a third copy of this list (campaign-followups.ts)
// had drifted to 11 of the 18 categories before it was caught.
const CAMPAIGN_TYPES = ['Individual','Nonprofit','Business'];

const STATUS_LABEL: Record<string, string> = {
  active: 'Published', draft: 'Draft', paused: 'Paused',
  completed: 'Completed', rejected: 'Archived', frozen: 'Frozen',
};
const STATUS_TONE: Record<string, string> = {
  active: 'green', draft: 'gray', paused: 'orange',
  completed: 'blue', rejected: 'red', frozen: 'red',
};

// Campaign Tools shown on the detail view — mirrors the organizer campaign
// workspace, plus admin-only tools at the end. Clicking a card swaps the
// content area below; nothing navigates away.
const DETAIL_TOOLS: { key: DetailTab; icon: string; label: string; desc: string; admin?: boolean }[] = [
  { key: 'supporters', icon: 'users', label: 'My Supporters', desc: 'Donor CRM + re-engagement' },
  { key: 'share', icon: 'send', label: 'Share & AI Content', desc: 'UTM links + AI posts' },
  { key: 'thank-donors', icon: 'chat', label: 'Thank Donors', desc: 'Email your supporters' },
  { key: 'ledger', icon: 'doc', label: 'Fund Ledger', desc: 'Track how funds are used' },
  { key: 'faqs', icon: 'doc', label: 'Manage FAQs', desc: 'AI-generated Q&A' },
  { key: 'qr-poster', icon: 'send', label: 'Print QR Poster', desc: 'Download & print' },
  { key: 'post-update', icon: 'doc', label: 'Post Update', desc: 'Keep donors informed' },
  { key: 'analytics', icon: 'chart', label: 'Analytics', desc: 'Trends & attribution' },
  { key: 'settings', icon: 'settings', label: 'Settings', desc: 'Visibility & donations' },
  { key: 'overview', icon: 'stack', label: 'Overview', desc: 'Admin summary & health', admin: true },
  { key: 'donations', icon: 'gift', label: 'Donations', desc: 'All donations (admin)', admin: true },
  { key: 'payouts', icon: 'audit', label: 'Payouts', desc: 'Freeze / unfreeze payouts', admin: true },
  { key: 'more', icon: 'settings', label: 'Admin Controls', desc: 'Trust, media, featured', admin: true },
  // `admin_notes` shipped with RLS and a CHECK constraint and no reader or
  // writer. A trust review done without the previous reviewer's reasoning is a
  // coin flip dressed as a process.
  { key: 'notes', icon: 'doc', label: 'Case Notes', desc: 'Why the last reviewer decided', admin: true },
];

const STATUS_PANEL_TEXT: Record<string, string> = {
  active:    'Your campaign is live and accepting donations.',
  paused:    'Donations are paused. The page is still visible.',
  draft:     'Not yet published. Publish to start accepting donations.',
  completed: 'Campaign is closed. No new donations accepted.',
  frozen:    'Campaign frozen by trust & safety.',
  rejected:  'Campaign archived. Not visible in search.',
};

const STATUS_PANEL_ACTIONS: Record<string, { label: string; next: string; color: string; confirm?: string }[]> = {
  active: [
    { label: 'Pause Donations', next: 'paused', color: 'var(--orange-text)', confirm: 'Pausing stops new donations but keeps the page live. Continue?' },
    { label: 'Close Campaign', next: 'completed', color: 'var(--t3)', confirm: 'Closing marks the campaign as completed. Donors will see it as ended. Continue?' },
  ],
  paused: [
    { label: 'Resume Donations', next: 'active', color: 'var(--green-text)' },
    { label: 'Close Campaign', next: 'completed', color: 'var(--t3)', confirm: 'Close this campaign permanently?' },
  ],
  draft: [
    { label: 'Publish Campaign', next: 'active', color: 'var(--green-text)' },
  ],
  completed: [
    { label: 'Archive Campaign', next: 'rejected', color: 'var(--t3)', confirm: 'Archived campaigns are hidden from search.' },
  ],
};

function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
/**
 * Delegates to the shared helper so admin cannot drift from the public page.
 * Used only for a campaign just created in this session, which is active by
 * construction — the detail panel above uses `campaignTimeLabel` with the real
 * status.
 */
function daysLeft(deadline: string | null): number | null {
  return campaignDaysLeft(deadline);
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
type Props = {
  campaigns: AdminCampaign[];
  totalCount?: number;
  activeCount?: number;
  attentionCount?: number;
  draftCount?: number;
};

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────
export default function AdminCampaignsClient({
  campaigns: initialCampaigns,
  totalCount,
  activeCount,
  attentionCount,
  draftCount,
}: Props) {
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
  const [activeTab, setActiveTab] = useState<DetailTab>('supporters');
  const [showActions, setShowActions] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [loadingTab, setLoadingTab] = useState(false);

  // ── Create wizard state
  const [createStep, setCreateStep] = useState(1);
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    title: '', category: 'Medical', goal: '', campaignType: 'Individual',
    tagline: '', description: '', deadline: '', beneficiaryName: '',
    coverImageUrl: '', visibility: 'Public', allowUpdates: true, allowRecurring: false,
  });
  const [createError, setCreateError] = useState('');
  const [createdCampaign, setCreatedCampaign] = useState<AdminCampaign | null>(null);

  useEffect(() => {
    if (!confirmAction) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmAction(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmAction]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived counts for tabs
  const counts = useMemo(() => ({
    all:      campaigns.length,
    active:   campaigns.filter(c => c.status === 'active').length,
    draft:    campaigns.filter(c => c.status === 'draft').length,
    paused:   campaigns.filter(c => c.status === 'paused').length,
    rejected: campaigns.filter(c => c.status === 'rejected').length,
    featured: campaigns.filter(c => c.featured).length,
    homepage: campaigns.filter(c =>
      c.status === 'active' &&
      c.coverImageUrl !== null &&
      c.coverImageUrl.startsWith('http')
    ).length,
  }), [campaigns]);

  // ── Filtered + paginated
  const filtered = useMemo(() => campaigns.filter(c => {
    const text = `${c.title} ${c.organizer} ${c.category}`.toLowerCase();
    const matchQuery = text.includes(query.toLowerCase());
    let matchTab = false;
    if (statusTab === 'all')        matchTab = true;
    else if (statusTab === 'featured') matchTab = c.featured;
    else if (statusTab === 'homepage') matchTab =
      c.status === 'active' &&
      c.coverImageUrl !== null &&
      (c.coverImageUrl ?? '').startsWith('http');
    else if (statusTab === 'paused')   matchTab = ['paused', 'frozen', 'rejected'].includes(c.status);
    else matchTab = c.status === statusTab;
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
    setActiveTab('supporters');
    setShowActions(false);
    setDonations(null);
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
  }, [donations]);

  function patchCampaign(patch: Record<string, unknown>, optimistic?: Partial<AdminCampaign>) {
    if (!selected) return;
    const id = selected.id;
    // Snapshot pre-edit state for rollback
    const selectedSnapshot = { ...selected };
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
      const result = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; warning?: string; campaign?: Partial<AdminCampaign> };
      if (!res.ok) {
        setNotice(`❌ ${result.error ?? 'Update failed. Please try again.'}`);
        // Revert optimistic update
        if (optimistic) {
          setCampaigns(cs => cs.map(c => c.id === id ? { ...c, ...selectedSnapshot } : c));
          setSelected(prev => prev ? { ...prev, ...selectedSnapshot } : prev);
        }
      } else {
        // Merge confirmed DB values back into state
        if (result.campaign) {
          setCampaigns(cs => cs.map(c => c.id === id ? { ...c, ...result.campaign } : c));
          setSelected(prev => prev ? { ...prev, ...result.campaign } : prev);
        }
        const msg = result.warning
          ? `✓ Saved (note: ${result.warning})`
          : '✓ Campaign saved successfully.';
        setNotice(msg);
        setTimeout(() => setNotice(''), 4000);
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
        imageUrls: [],
        videoUrl: null,
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
  // DB-level counts (for metric cards, more accurate than filtered local set)
  const dbTotal      = totalCount      ?? counts.all;
  const dbActive     = activeCount     ?? counts.active;
  const dbAttention  = attentionCount  ?? (counts.paused + counts.rejected);
  const dbDraft      = draftCount      ?? counts.draft;

  const metricCards = [
    {
      key: 'all',
      label: 'All Campaigns',
      value: dbTotal.toLocaleString(),
      sub: 'all statuses',
      icon: 'stack',
      tone: '#6c35ff',
      bg: '#f0eaff',
    },
    {
      key: 'active',
      label: 'Active',
      value: dbActive.toLocaleString(),
      sub: 'live right now',
      icon: 'check',
      tone: '#16a34a',
      bg: '#f0fdf4',
    },
    {
      key: 'attention',
      label: 'Needs Attention',
      value: dbAttention.toLocaleString(),
      sub: 'paused, frozen, rejected',
      icon: 'audit',
      tone: '#d97706',
      bg: '#fffbeb',
      filterKey: 'paused',
    },
    {
      key: 'draft',
      label: 'Drafts',
      value: dbDraft.toLocaleString(),
      sub: 'not yet published',
      icon: 'doc',
      tone: '#2563eb',
      bg: '#eff6ff',
    },
  ];

  if (view === 'list') return (
    <div className="ac-wrap">
      {/* Clickable metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
        {metricCards.map(m => {
          const tabKey = (m as { filterKey?: string }).filterKey ?? m.key;
          const isActive = statusTab === tabKey;
          return (
            <button
              key={m.key}
              onClick={() => { setStatusTab(tabKey); setPage(1); }}
              style={{
                display: 'flex', minWidth: 0, alignItems: 'center', gap: 14,
                padding: '16px 18px', borderRadius: 14, textAlign: 'left',
                background: isActive ? m.tone : 'var(--s1)',
                border: `2px solid ${isActive ? m.tone : 'var(--line)'}`,
                cursor: 'pointer', transition: 'all .15s',
                boxShadow: isActive ? `0 4px 14px ${m.tone}33` : '0 1px 4px rgba(0,0,0,.06)',
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: isActive ? 'rgba(255,255,255,.25)' : m.bg,
                display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center',
                color: isActive ? '#fff' : m.tone, fontSize: 18,
              }}>
                <KFIcon name={m.icon} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#fff' : 'var(--t3)', letterSpacing: '.04em', marginBottom: 2 }}>
                  {m.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: isActive ? '#fff' : 'var(--t1)', lineHeight: 1 }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 11, color: isActive ? '#fff' : 'var(--t3)', marginTop: 2 }}>
                  {m.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

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
          { key: 'all',      label: `All (${counts.all})` },
          { key: 'active',   label: `Published (${counts.active})` },
          { key: 'draft',    label: `Draft (${counts.draft})` },
          { key: 'paused',   label: `Needs Attention (${counts.paused + counts.rejected})` },
          { key: 'rejected', label: `Archived (${counts.rejected})` },
          { key: 'featured', label: `⭐ Featured (${counts.featured})`, accent: true },
          { key: 'homepage', label: `🏠 Homepage (${counts.homepage})`, accent: true },
        ].map(t => (
          <button
            key={t.key}
            className={`ac-stab${statusTab === t.key ? ' active' : ''}${(t as { accent?: boolean }).accent ? ' accent' : ''}`}
            onClick={() => { setStatusTab(t.key); setPage(1); }}
          >{t.label}</button>
        ))}
      </div>

      {/* Context banner for special tabs */}
      {statusTab === 'featured' && (
        <div style={{ margin: '0 0 14px', padding: '10px 16px', background: 'var(--tint-amber)', border: '1px solid #fcd34d', borderRadius: 10, fontSize: 13, color: 'var(--orange-text)', fontWeight: 600 }}>
          ⭐ Featured campaigns appear <strong>first</strong> in the homepage hero rotator. Toggle via the campaign&apos;s <em>More</em> tab → &ldquo;Feature on Homepage&rdquo;.
        </div>
      )}
      {statusTab === 'homepage' && (
        <div style={{ margin: '0 0 14px', padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
          🏠 These are all <strong>active campaigns with a cover photo</strong> — they rotate on the homepage carousel. Featured ones appear first.
        </div>
      )}

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
          <span>Flags</span>
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
            <span className="ac-cell" style={{ display: 'flex', minWidth: 0, gap: 4, flexWrap: 'wrap' }}>
              {c.featured && (
                <span style={{ fontSize: 10, fontWeight: 650, padding: '2px 7px', borderRadius: 6, background: 'var(--tint-amber)', border: '1px solid #fcd34d', color: 'var(--orange-text)' }}>⭐ Featured</span>
              )}
              {c.coverImageUrl?.startsWith('http') && c.status === 'active' && (
                <span style={{ fontSize: 10, fontWeight: 650, padding: '2px 7px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>🏠 Carousel</span>
              )}
            </span>
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

        {/* ── Hero strip (status + metrics) ── */}
        <div className="kf-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 96, height: 96, borderRadius: 12, flexShrink: 0,
                background: selected.coverImageUrl
                  ? `url(${selected.coverImageUrl}) center/cover no-repeat`
                  : 'linear-gradient(135deg,#ede9fe,#6c35ff)',
              }}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <SPill status={selected.status} />
                {selected.category && (
                  <span style={{ fontSize: 12, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 8px', borderRadius: 6 }}>
                    {selected.category}
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 'auto' }}>
                  Created {fmtDate(selected.createdAt)}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', fontSize: 13, color: 'var(--t2)', marginBottom: 6 }}>
                <span><strong style={{ color: 'var(--green-text)' }}>{fmtCents(selected.raisedAmount)}</strong> raised of {fmtCents(selected.goalAmount)}</span>
                <span><strong>{progress}%</strong> funded</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--b1)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--green)', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', minWidth: 0, gap: 24, flexWrap: 'wrap' }}>
                {[
                  { label: 'Backers', value: selected.backerCount.toLocaleString() },
                  // Shared with the public campaign page, and it consults `status`.
                  // The previous version read the deadline alone, so a completed
                  // campaign with a future date showed "136 days left" directly
                  // beside a status pill saying otherwise.
                  { label: 'Deadline', value: selected.deadline === null ? '—' : campaignTimeLabel({ status: selected.status, deadline: selected.deadline }) },
                  { label: 'Organizer', value: selected.organizer },
                  // 0 means "never scored" — campaign_health_score defaults to 0 and
                  // only a manual admin edit writes it — so rendering "0/100" made
                  // every unscored campaign look measured-and-failing.
                  { label: 'Health Score', value: selected.healthScore > 0 ? `${selected.healthScore}/100` : 'Not scored' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <strong style={{ fontSize: 18, fontWeight: 700, display: 'block', lineHeight: 1 }}>{value}</strong>
                    <small style={{ fontSize: 12, color: 'var(--t3)' }}>{label}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions + Campaign Status ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 24, alignItems: 'start', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              onClick={() => { setActiveTab('edit'); setShowActions(false); }}
              className="kf-primary"
              style={{ display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              <KFIcon name="doc" /> Edit Campaign
            </button>
            <button type="button" onClick={backToList} className="kf-outline"
              style={{ display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              ← Back
            </button>
          </div>
          <section className="kf-card" style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 650 }}>Campaign Status</h2>
            <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <SPill status={selected.status} />
              <span style={{ fontSize: 13, color: 'var(--t3)' }}>
                {STATUS_PANEL_TEXT[selected.status] ?? ''}
              </span>
            </div>
            <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
              {(STATUS_PANEL_ACTIONS[selected.status] ?? []).map(action => (
                <button
                  key={action.next}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (action.confirm && !window.confirm(action.confirm)) return;
                    patchCampaign({ status: action.next }, { status: action.next });
                  }}
                  style={{
                    height: 38, padding: '0 18px', border: 0, borderRadius: 9,
                    background: action.color, color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? '…' : action.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ── Campaign Tools ── */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 650 }}>Campaign Tools</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {DETAIL_TOOLS.map(tool => {
              const active = activeTab === tool.key;
              return (
                <button
                  key={tool.key}
                  type="button"
                  onClick={() => void loadTab(tool.key, selected.id)}
                  className="kf-card"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                    padding: '14px 14px', cursor: 'pointer', textAlign: 'left', font: 'inherit',
                    border: active ? '1.5px solid #6c35ff' : undefined,
                    background: active ? 'rgba(108,53,255,.06)' : undefined,
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  <KFIcon name={tool.icon} />
                  <strong style={{ fontSize: 13, color: active ? 'var(--brand-text)' : 'var(--t1)', marginTop: 6 }}>
                    {tool.label}{tool.admin ? ' 🛡' : ''}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>{tool.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Tool content — loads inline below the tools row */}
        <div className="ac-detail-body">
          {loadingTab && <div className="ac-loading">Loading…</div>}

          {/* ── Organizer workspace panels ── */}
          {!loadingTab && activeTab === 'supporters' && <SupportersPanel campaignId={selected.id} showHeading />}
          {!loadingTab && activeTab === 'share' && <SharePanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'thank-donors' && <ThankDonorsPanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'ledger' && <LedgerPanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'faqs' && <FaqsPanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'notes' && (
            <AdminNotesPanel targetType="campaign" targetId={selected.id} title="Case notes for this campaign" />
          )}
          {!loadingTab && activeTab === 'qr-poster' && <QrPosterPanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'post-update' && <UpdatesPanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'analytics' && <AnalyticsPanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'settings' && <SettingsPanel campaignId={selected.id} />}
          {!loadingTab && activeTab === 'edit' && <EditCampaignPanel campaignId={selected.id} />}

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
                    {/* Label, not a bare number: a completed campaign showed a
                        "Days Left" figure counting down beside its status pill. */}
                    {selected.deadline !== null && <div className="ac-stat"><b>{campaignTimeLabel({ status: selected.status, deadline: selected.deadline })}</b><span>Deadline</span></div>}
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
                    <span className={`ac-health ${selected.healthScore === 0 ? '' : selected.healthScore >= 70 ? 'good' : selected.healthScore >= 40 ? 'warn' : 'bad'}`}>
                      {selected.healthScore > 0 ? `${selected.healthScore}/100` : 'Not scored'}
                    </span>
                  </span>
                  <span>Payouts</span><span>{selected.payoutFrozen ? '🔒 Frozen' : '✓ Open'}</span>
                  {selected.featured && <><span>Featured</span><span>⭐ Yes</span></>}
                  {selected.pinned && <><span>Pinned</span><span>📌 Yes</span></>}
                </div>
                {selected.description && (
                  <div className="ac-desc-block">
                    <div className="ac-desc-label">Description</div>
                    <p>{selected.description}</p>
                  </div>
                )}
              </div>
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

          {/* ── Admin Controls (trust, media, featured) ── */}
          {!loadingTab && activeTab === 'more' && (
            <div className="ac-tab-pane ac-edit-form">
              <h3>Admin Controls</h3>
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
            <ActionItem icon="doc" label="Edit Campaign" onClick={() => { setShowActions(false); setActiveTab('edit'); }} />
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
              <ActionItem icon="crown" label="Feature Campaign" onClick={() => patchCampaign({ featured: !selected.featured }, { featured: !selected.featured })} />
              <label className="ac-toggle">
                <input
                  type="checkbox"
                  checked={selected.featured}
                  onChange={e => patchCampaign({ featured: e.target.checked }, { featured: e.target.checked })}
                  aria-label="Feature campaign"
                />
                <span />
              </label>
            </div>
            <div className="ac-action-toggle">
              <ActionItem icon="link" label="Pin to Homepage" onClick={() => patchCampaign({ pinned: !selected.pinned }, { pinned: !selected.pinned })} />
              <label className="ac-toggle">
                <input
                  type="checkbox"
                  checked={selected.pinned}
                  onChange={e => patchCampaign({ pinned: e.target.checked }, { pinned: e.target.checked })}
                  aria-label="Pin to homepage"
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
          // Backdrop dismissal is supplementary; Escape and the close button remain available.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div className="ac-modal-overlay" onClick={event => { if (event.target === event.currentTarget) setConfirmAction(null); }}>
            <div className="ac-modal">
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
              <label htmlFor="cc-title">Campaign Title *</label>
              <input id="cc-title" className="ac-input" value={createDraft.title} onChange={e => upd('title', e.target.value)} placeholder="e.g. Help Sarah cover emergency medical bills" maxLength={100} />
            </div>
            <div className="ac-field">
              <label htmlFor="cc-category">Category</label>
              <select id="cc-category" className="ac-input" value={createDraft.category} onChange={e => upd('category', e.target.value)}>
                {CAMPAIGN_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="ac-field">
              <label htmlFor="cc-type">Campaign Type</label>
              <select id="cc-type" className="ac-input" value={createDraft.campaignType} onChange={e => upd('campaignType', e.target.value)}>
                {CAMPAIGN_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="ac-field">
              <label htmlFor="cc-goal">Goal Amount (USD) *</label>
              <input id="cc-goal" className="ac-input" type="number" min="1" value={createDraft.goal} onChange={e => upd('goal', e.target.value)} placeholder="25000" />
            </div>
            <div className="ac-field">
              <label htmlFor="cc-beneficiary">Beneficiary Name</label>
              <input id="cc-beneficiary" className="ac-input" value={createDraft.beneficiaryName} onChange={e => upd('beneficiaryName', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="ac-create-nav">
              <button className="ac-btn-outline" onClick={backToList}>Cancel</button>
              <div style={{ display: 'flex', minWidth: 0, gap: 10 }}>
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
              <label htmlFor="cc-tagline">Short Tagline</label>
              <input id="cc-tagline" className="ac-input" value={createDraft.tagline} onChange={e => upd('tagline', e.target.value)} placeholder="A clear, emotional summary of your need" maxLength={160} />
            </div>
            <div className="ac-field full">
              <label htmlFor="cc-story">Full Story *</label>
              <textarea id="cc-story" className="ac-textarea" rows={8} value={createDraft.description} onChange={e => upd('description', e.target.value)} placeholder={'Who needs help? What happened? Why now?\nHow will the funds be used?'} />
            </div>
            <div className="ac-field">
              <label htmlFor="cc-deadline">End Date (optional)</label>
              <input id="cc-deadline" className="ac-input" type="date" value={createDraft.deadline} onChange={e => upd('deadline', e.target.value)} />
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
              <label htmlFor="cc-cover">Cover Image URL</label>
              <input
                id="cc-cover"
                className="ac-input"
                value={createDraft.coverImageUrl}
                onChange={e => upd('coverImageUrl', e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              <input
                type="file"
                aria-label="Upload a campaign cover image"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  fd.append('type', 'cover');
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
              <label htmlFor="cc-visibility">Visibility</label>
              <select id="cc-visibility" className="ac-input" value={createDraft.visibility} onChange={e => upd('visibility', e.target.value)}>
                <option>Public</option>
                <option>Private</option>
              </select>
            </div>
            <div className="ac-field">
              <label htmlFor="cc-payout">Payout Account</label>
              <select id="cc-payout" className="ac-input">
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
  const [mediaSection, setMediaSection] = useState<'cover' | 'gallery' | 'video'>('cover');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  // Track the campaign id we last initialised draft from
  const lastInitId = React.useRef(campaign.id);

  // When a DIFFERENT campaign is opened, reset the draft entirely.
  // When the SAME campaign's prop changes (after an optimistic update from the
  // parent), we only reset fields the user has NOT yet locally modified.
  // The simplest safe approach: re-initialise if the id changes.
  React.useEffect(() => {
    if (campaign.id !== lastInitId.current) {
      setDraft(campaign);
      lastInitId.current = campaign.id;
    }
  }, [campaign]);

  // Deep-compare so Save button only enables when there are actual changes
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
      cover_image_url: draft.coverImageUrl,
      image_urls: draft.imageUrls,
      video_url: draft.videoUrl,
      featured: draft.featured,
      pinned: draft.pinned,
    }, draft);
  }

  async function uploadCover(file: File) {
    setUploadingCover(true); setMediaError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('campaignId', campaign.id);
      fd.append('type', 'cover');
      const res = await fetch('/api/upload/campaign-image', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setMediaError(data.error ?? 'Upload failed.'); return; }
      if (data.url) upd('coverImageUrl', data.url);
    } catch { setMediaError('Upload failed. Please try again.'); }
    finally { setUploadingCover(false); }
  }

  async function uploadGalleryImage(file: File) {
    setUploadingGallery(true); setMediaError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('campaignId', campaign.id);
      fd.append('type', 'gallery');
      const res = await fetch('/api/upload/campaign-image', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setMediaError(data.error ?? 'Upload failed.'); return; }
      if (data.url) upd('imageUrls', [...(draft.imageUrls ?? []), data.url]);
    } catch { setMediaError('Upload failed. Please try again.'); }
    finally { setUploadingGallery(false); }
  }

  function removeGalleryImage(url: string) {
    upd('imageUrls', (draft.imageUrls ?? []).filter(u => u !== url));
  }

  function getVideoEmbedUrl(url: string): string | null {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return null;
  }

  const sectionTabStyle = (active: boolean) => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' as const,
    border: 'none',
    background: active ? '#6c35ff' : 'transparent',
    color: active ? '#fff' : 'var(--t3)',
    transition: 'all .15s',
  });

  return (
    <div className="ac-form-grid">

      {/* ── Core fields ── */}
      <div className="ac-field full"><label htmlFor="ec-title">Title</label><input id="ec-title" className="ac-input" value={draft.title} onChange={e => upd('title', e.target.value)} /></div>
      <div className="ac-field"><label htmlFor="ec-category">Category</label><input id="ec-category" className="ac-input" value={draft.category} onChange={e => upd('category', e.target.value)} /></div>
      <div className="ac-field"><label htmlFor="ec-status">Status</label>
        <select id="ec-status" className="ac-input" value={draft.status} onChange={e => upd('status', e.target.value)}>
          {['draft','active','paused','completed','rejected','frozen'].map(s => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
        </select>
      </div>
      <div className="ac-field"><label htmlFor="ec-trust">Trust Status</label>
        <select id="ec-trust" className="ac-input" value={draft.trustStatus} onChange={e => upd('trustStatus', e.target.value)}>
          {['Needs More Info','Under Review','Trusted','Verified','Flagged'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="ac-field"><label htmlFor="ec-goal">Goal Amount ($)</label><input id="ec-goal" className="ac-input" type="number" min={0} value={Math.round(draft.goalAmount / 100)} onChange={e => upd('goalAmount', Number(e.target.value) * 100)} /></div>
      <div className="ac-field"><label htmlFor="ec-health">Health Score (0–100)</label><input id="ec-health" className="ac-input" type="number" min={0} max={100} value={draft.healthScore} onChange={e => upd('healthScore', Number(e.target.value))} /></div>
      <div className="ac-field full">
        <label className="ac-check-label"><input type="checkbox" checked={draft.payoutFrozen} onChange={e => upd('payoutFrozen', e.target.checked)} /> Freeze payouts for review</label>
      </div>
      <div className="ac-field full"><label htmlFor="ec-tagline">Tagline</label><input id="ec-tagline" className="ac-input" value={draft.tagline} onChange={e => upd('tagline', e.target.value)} /></div>
      <div className="ac-field full"><label htmlFor="ec-description">Description</label><textarea id="ec-description" className="ac-textarea" rows={5} value={draft.description} onChange={e => upd('description', e.target.value)} /></div>

      {/* ── MEDIA MANAGEMENT ── */}
      <div className="ac-field full" style={{ borderTop: '1px solid #eef0f7', paddingTop: 20, marginTop: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <strong style={{ fontSize: 14, fontWeight: 650, color: 'var(--t1)' }}>Media Management</strong>
          <div style={{ display: 'flex', minWidth: 0, gap: 4, background: 'var(--s2)', borderRadius: 10, padding: 4 }}>
            <button style={sectionTabStyle(mediaSection === 'cover')}   onClick={() => setMediaSection('cover')}>Cover Image</button>
            <button style={sectionTabStyle(mediaSection === 'gallery')} onClick={() => setMediaSection('gallery')}>Gallery ({(draft.imageUrls ?? []).length})</button>
            <button style={sectionTabStyle(mediaSection === 'video')}   onClick={() => setMediaSection('video')}>Video</button>
          </div>
        </div>

        {mediaError && (
          <div style={{ padding: '10px 14px', background: 'var(--tint-rose)', border: '1px solid #fecdd3', borderRadius: 9, color: 'var(--red-text)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            ⚠ {mediaError}
          </div>
        )}

        {/* ── Cover Image ── */}
        {mediaSection === 'cover' && (
          <div>
            {draft.coverImageUrl ? (
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.coverImageUrl}
                  alt="Campaign cover"
                  style={{ width: '100%', maxWidth: 480, height: 200, objectFit: 'cover', borderRadius: 12, border: '1px solid #e2e8f0', display: 'block' }}
                />
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', minWidth: 0, gap: 6 }}>
                  <a
                    href={draft.coverImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none' }}
                    title="View full size"
                  >↗</a>
                  <button
                    type="button"
                    title="Remove cover image"
                    onClick={() => { upd('coverImageUrl', null); }}
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(190,18,60,.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--t3)', wordBreak: 'break-all' }}>
                  {draft.coverImageUrl.slice(0, 80)}{draft.coverImageUrl.length > 80 ? '…' : ''}
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', maxWidth: 480, height: 160, borderRadius: 12, border: '2px dashed #e2e8f0', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                No cover image set
              </div>
            )}
            <input aria-label="Upload cover image" ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) void uploadCover(f); e.target.value = ''; }} />
            <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
              <button type="button" disabled={uploadingCover} onClick={() => coverInputRef.current?.click()}
                style={{ padding: '8px 18px', border: '1px solid #6c35ff', borderRadius: 9, background: 'var(--s2)', color: 'var(--brand-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {uploadingCover ? 'Uploading…' : draft.coverImageUrl ? '↑ Replace Cover Image' : '↑ Upload Cover Image'}
              </button>
              {draft.coverImageUrl && (
                <button type="button" onClick={() => upd('coverImageUrl', null)}
                  style={{ padding: '8px 18px', border: '1px solid #fca5a5', borderRadius: 9, background: 'var(--tint-rose)', color: 'var(--red-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Remove Cover
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Gallery ── */}
        {mediaSection === 'gallery' && (
          <div>
            {(draft.imageUrls ?? []).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: 12, color: 'var(--t3)', fontSize: 14, marginBottom: 14 }}>
                No gallery images. Upload up to 10 photos.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
                {(draft.imageUrls ?? []).map((url, i) => (
                  <div key={url} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Gallery ${i + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', minWidth: 0, gap: 4 }}>
                      {i === 0 && (
                        <span style={{ padding: '2px 8px', background: '#6c35ff', color: '#fff', fontSize: 10, fontWeight: 650, borderRadius: 6 }}>
                          COVER
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, left: 0, display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', padding: '4px 6px', background: 'linear-gradient(0deg,rgba(0,0,0,.6),transparent)' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.8)' }}>#{i + 1}</span>
                      <div style={{ display: 'flex', minWidth: 0, gap: 4 }}>
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,.2)', color: '#fff', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', fontSize: 12, textDecoration: 'none' }}
                          title="View full size">↗</a>
                        <button type="button" onClick={() => removeGalleryImage(url)}
                          title="Remove image"
                          style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(190,18,60,.75)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center' }}>
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input aria-label="Upload gallery images" ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }}
              onChange={async e => {
                const files = Array.from(e.target.files ?? []).slice(0, 10 - (draft.imageUrls ?? []).length);
                for (const f of files) await uploadGalleryImage(f);
                e.target.value = '';
              }} />
            <button type="button"
              disabled={uploadingGallery || (draft.imageUrls ?? []).length >= 10}
              onClick={() => galleryInputRef.current?.click()}
              style={{ padding: '8px 18px', border: '1px solid #6c35ff', borderRadius: 9, background: 'var(--s2)', color: 'var(--brand-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {uploadingGallery ? 'Uploading…' : `↑ Add Images (${(draft.imageUrls ?? []).length}/10)`}
            </button>
            {(draft.imageUrls ?? []).length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>
                First image is used as the cover on the campaign page if no separate cover image is set.
              </p>
            )}
          </div>
        )}

        {/* ── Video ── */}
        {mediaSection === 'video' && (
          <div>
            {draft.videoUrl && getVideoEmbedUrl(draft.videoUrl) ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 12, background: '#000', maxWidth: 480 }}>
                  <iframe
                    src={getVideoEmbedUrl(draft.videoUrl)!}
                    title="Campaign video preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6, wordBreak: 'break-all' }}>{draft.videoUrl}</p>
              </div>
            ) : draft.videoUrl ? (
              <div style={{ padding: '14px', background: 'var(--tint-amber)', border: '1px solid #fde68a', borderRadius: 10, marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: 'var(--orange-text)', margin: 0 }}>⚠ URL set but not a recognized YouTube/Vimeo link. It will still be saved.</p>
                <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0', wordBreak: 'break-all' }}>{draft.videoUrl}</p>
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: 12, color: 'var(--t3)', fontSize: 14, marginBottom: 14 }}>
                No video set. Paste a YouTube or Vimeo URL below.
              </div>
            )}
            <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'center' }}>
              <input
                className="ac-input"
                aria-label="Video URL" value={draft.videoUrl ?? ''}
                onChange={e => upd('videoUrl', e.target.value || null)}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                style={{ flex: 1 }}
              />
              {draft.videoUrl && (
                <button type="button" onClick={() => upd('videoUrl', null)}
                  style={{ padding: '8px 14px', border: '1px solid #fca5a5', borderRadius: 9, background: 'var(--tint-rose)', color: 'var(--red-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  Remove
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>
              Supported: YouTube (youtube.com/watch?v=, youtu.be/) and Vimeo (vimeo.com/). The video will be embedded on the public campaign page.
            </p>
          </div>
        )}
      </div>

      {/* ── Feature Campaign ── */}
      <div className="ac-field full" style={{ borderTop: '1px solid #eef0f7', paddingTop: 20, marginTop: 4 }}>
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong style={{ fontSize: 14, fontWeight: 650, color: 'var(--t1)', display: 'block', marginBottom: 4 }}>
              {draft.featured ? '⭐ Featured on Homepage' : '☆ Feature on Homepage'}
            </strong>
            <span style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
              Featured campaigns appear <strong>first</strong> in the homepage hero rotator.<br />
              Campaign must have a cover photo and be active to show in the rotator.
            </span>
          </div>
          <button
            type="button"
            onClick={() => upd('featured', !draft.featured)}
            style={{
              height: 40, padding: '0 20px', borderRadius: 10, fontWeight: 650, fontSize: 13, cursor: 'pointer',
              border: draft.featured ? '1.5px solid #f59e0b' : '1.5px solid #6c35ff',
              background: draft.featured ? '#fffbeb' : '#f0eaff',
              color: draft.featured ? 'var(--orange-text)' : '#4d1ee0',
              transition: 'all .15s', flexShrink: 0,
            }}
          >
            {draft.featured ? '★ Remove from Featured' : '☆ Add to Featured'}
          </button>
        </div>
        {draft.featured && !draft.coverImageUrl && (
          <p style={{ fontSize: 12, color: 'var(--orange-text)', fontWeight: 600, margin: '8px 0 0' }}>
            ⚠ This campaign has no cover image — it will not appear in the rotator until one is added.
          </p>
        )}
      </div>

      {/* ── Save ── */}
      <div className="ac-field full">
        <button className="ac-btn-primary" disabled={!changed || isPending} onClick={save}>
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
