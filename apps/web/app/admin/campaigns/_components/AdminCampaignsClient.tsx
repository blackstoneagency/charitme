'use client';

import { useMemo, useState, useTransition } from 'react';
import { KFIcon, StatusPill } from '../../../../components/KindFundApp';

export type AdminCampaign = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: string;
  trustStatus: string;
  payoutFrozen: boolean;
  healthScore: number;
  raisedAmount: number;
  goalAmount: number;
  backerCount: number;
  category: string;
  organizer: string;
  createdAt: string;
};

type Props = {
  campaigns: AdminCampaign[];
};

const statusOptions = ['draft', 'active', 'paused', 'completed', 'rejected', 'frozen'];
const trustOptions = ['Needs More Info', 'Under Review', 'Verified', 'Flagged'];

function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function AdminCampaignsClient({ campaigns: initialCampaigns }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState<AdminCampaign | null>(initialCampaigns[0] ?? null);
  const [draft, setDraft] = useState<AdminCampaign | null>(initialCampaigns[0] ?? null);
  const [notice, setNotice] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => campaigns.filter((campaign) => {
    const text = `${campaign.title} ${campaign.organizer} ${campaign.category} ${campaign.status}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (statusFilter === 'All' || campaign.status === statusFilter);
  }), [campaigns, query, statusFilter]);

  function choose(campaign: AdminCampaign) {
    setSelected(campaign);
    setDraft(campaign);
    setNotice('');
  }

  function updateDraft<K extends keyof AdminCampaign>(key: K, value: AdminCampaign[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  function saveCampaign() {
    if (!draft) return;
    setNotice('');
    startTransition(async () => {
      const response = await fetch(`/api/admin/campaigns/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          tagline: draft.tagline,
          description: draft.description,
          category: draft.category,
          status: draft.status,
          trust_status: draft.trustStatus,
          payout_frozen: draft.payoutFrozen,
          campaign_health_score: draft.healthScore,
          goal_amount: draft.goalAmount,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(result.error ?? 'Campaign could not be updated.');
        return;
      }
      setCampaigns((items) => items.map((item) => item.id === draft.id ? draft : item));
      setSelected(draft);
      setNotice('Campaign changes saved.');
      setTimeout(() => setNotice(''), 2500);
    });
  }

  return (
    <div className="admin-campaigns">
      <section className="admin-campaign-list kf-card">
        <div className="admin-campaign-tools">
          <label className="kf-search">
            <KFIcon name="search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns..." />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>All</option>
            {statusOptions.map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
        <div className="admin-campaign-row head"><span>Campaign</span><span>Status</span><span>Raised</span><span>Trust</span></div>
        {filtered.map((campaign) => (
          <button key={campaign.id} className={`admin-campaign-row ${selected?.id === campaign.id ? 'active' : ''}`} onClick={() => choose(campaign)}>
            <span><strong>{campaign.title}</strong><small>{campaign.organizer} - {campaign.category}</small></span>
            <StatusPill>{campaign.status}</StatusPill>
            <b>{fmtCents(campaign.raisedAmount)}</b>
            <small>{campaign.trustStatus}</small>
          </button>
        ))}
        {filtered.length === 0 && <p className="admin-empty">No campaigns match the current filters.</p>}
      </section>

      <section className="admin-campaign-editor kf-card">
        {draft ? (
          <>
            <div className="kf-card-head">
              <div>
                <h2>Campaign Control Center</h2>
                <p style={{ margin: 0, color: '#67718e', fontSize: 13 }}>Edit live campaign details, review status, trust controls, and payout safety.</p>
              </div>
              <StatusPill>{draft.status}</StatusPill>
            </div>

            {notice && <div className={`admin-campaign-notice ${notice.includes('could not') ? 'error' : ''}`}>{notice}</div>}

            <div className="admin-campaign-form">
              <label>Title<input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} /></label>
              <label>Category<input value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} /></label>
              <label>Tagline<input value={draft.tagline} onChange={(event) => updateDraft('tagline', event.target.value)} /></label>
              <label>Goal Amount<input type="number" min={0} value={Math.round(draft.goalAmount / 100)} onChange={(event) => updateDraft('goalAmount', Number(event.target.value) * 100)} /></label>
              <label>Status<select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label>Trust Status<select value={draft.trustStatus} onChange={(event) => updateDraft('trustStatus', event.target.value)}>{trustOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label>Health Score<input type="number" min={0} max={100} value={draft.healthScore} onChange={(event) => updateDraft('healthScore', Number(event.target.value))} /></label>
              <label className="admin-check"><input type="checkbox" checked={draft.payoutFrozen} onChange={(event) => updateDraft('payoutFrozen', event.target.checked)} /> Freeze payouts for review</label>
              <label className="wide">Description<textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} /></label>
            </div>

            <div className="admin-campaign-facts">
              <span>Raised <b>{fmtCents(draft.raisedAmount)}</b></span>
              <span>Donors <b>{draft.backerCount.toLocaleString()}</b></span>
              <span>Created <b>{new Date(draft.createdAt).toLocaleDateString()}</b></span>
              <span>Payouts <b>{draft.payoutFrozen ? 'Frozen' : 'Open'}</b></span>
            </div>

            <div className="admin-campaign-actions">
              <button className="kf-outline" onClick={() => draft && updateDraft('status', 'paused')} disabled={isPending}>Pause</button>
              <button className="kf-outline" onClick={() => draft && updateDraft('status', 'active')} disabled={isPending}>Approve / Activate</button>
              <button className="kf-danger" onClick={() => draft && updateDraft('status', 'rejected')} disabled={isPending}>Reject</button>
              <button className="kf-primary" onClick={saveCampaign} disabled={isPending}>{isPending ? 'Saving...' : 'Save Campaign'}</button>
            </div>
          </>
        ) : (
          <p className="admin-empty">Select a campaign to manage it.</p>
        )}
      </section>
    </div>
  );
}
