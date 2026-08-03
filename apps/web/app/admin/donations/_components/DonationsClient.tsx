'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface DonationRecord {
  id: string;
  donor_name: string;
  donor_email: string;
  campaign_title: string;
  amount_cents: number;
  status: string;
  payment_method: string | null;
  anonymous: boolean;
  message: string | null;
  created_at: string;
}

export interface WeekPoint {
  week: string;
  total_cents: number;
  count: number;
}

export interface CampaignVolume {
  campaign_id: string;
  campaign_title: string;
  total_cents: number;
}

export interface TopDonor {
  donor_id: string;
  donor_name: string;
  total_cents: number;
  donation_count: number;
}

export interface DonationsClientProps {
  totalCents: number;
  donorCount: number;
  avgCents: number;
  totalDonationCount: number;
  completedCount: number;
  pendingCount: number;
  refundedCount: number;
  failedCount: number;
  donations: DonationRecord[];
  weeklyTrend: WeekPoint[];
  campaignVolumes: CampaignVolume[];
  topDonors: TopDonor[];
}

interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface DonationDetail {
  id: string;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  donorId: string | null;
  donorName: string;
  donorEmail: string;
  amountCents: number;
  status: string;
  anonymous: boolean;
  message: string;
  paymentMethod: string | null;
  source: string | null;
  notes: string | null;
  isSpam: boolean;
  receiptSentAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  auditLog: AuditEntry[];
}

type ViewState = 'overview' | 'detail';
type SuccessType = 'refund' | 'note' | 'receipt' | 'spam';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtCents(cents: number): string {
  const d = cents / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${d.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    'donation.refunded': 'Refund Processed',
    'donation.note_added': 'Note Added',
    'donation.receipt_sent': 'Receipt Sent',
    'donation.updated': 'Record Updated',
    'donation.spam_marked': 'Marked as Spam',
    'donation.spam_unmarked': 'Unmarked as Spam',
  };
  return map[action] ?? capitalize(action.replace(/\./g, ' '));
}

function auditActionColor(action: string): string {
  if (action.includes('refund')) return '#ff3b5f';
  if (action.includes('receipt')) return '#2563eb';
  if (action.includes('note')) return '#551cf2';
  if (action.includes('spam')) return '#f97316';
  return '#0fa456';
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendLine
// ─────────────────────────────────────────────────────────────────────────────
function TrendLine({ points }: { points: WeekPoint[] }) {
  if (points.length < 2) {
    return (
      <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--t3)', fontSize: 14 }}>
        Not enough data for chart
      </div>
    );
  }
  const W = 480;
  const H = 180;
  const pad = 16;
  const maxVal = Math.max(...points.map(p => p.total_cents), 1);
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map(p => pad + (1 - p.total_cents / maxVal) * (H - pad * 2));
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaD = `${pathD} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }} role="img" aria-label="Donation trend">
      <defs>
        <linearGradient id="donGrad" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#6c35ff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#6c35ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad} y1={pad + (1 - f) * (H - pad * 2)} x2={W - pad} y2={pad + (1 - f) * (H - pad * 2)} stroke="#eef0f7" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#donGrad)" />
      <path d={pathD} fill="none" stroke="#6c35ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="5" fill="#6c35ff" stroke="#fff" strokeWidth="3" />
      ))}
      {points.map((p, i) => (
        <text key={i} x={xs[i]} y={H - 2} textAnchor="middle" fontSize="10" fill="var(--t3)">
          {p.week.slice(5)}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DonutChart
// ─────────────────────────────────────────────────────────────────────────────
function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 1);
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 24 }}>
      <svg viewBox="0 0 160 160" style={{ width: 120, height: 120, flexShrink: 0 }}>
        {slices.map((s, index) => {
          const frac = s.value / total;
          const dash = frac * circumference;
          const offset = slices.slice(0, index).reduce((sum, item) => sum + (item.value / total), 0);
          return (
            <circle key={s.label} cx={cx} cy={cy} r={r}
              fill="none" stroke={s.color} strokeWidth="24"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset * circumference + circumference / 4}
              style={{ transition: 'all .3s' }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 12} fill="#fff" />
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
        {slices.map(s => (
          <div key={s.label} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'block' }} />
            <span>{s.label}</span>
            <b style={{ marginLeft: 'auto', color: 'var(--t1)' }}>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusPill
// ─────────────────────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone = s.includes('completed') || s.includes('success') ? 'green'
    : s.includes('pending') ? 'orange'
    : s.includes('refunded') ? 'violet'
    : s.includes('failed') ? 'red'
    : 'violet';
  return <span className={`kf-pill ${tone}`}>{capitalize(status)}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionItem
// ─────────────────────────────────────────────────────────────────────────────
function ActionItem({
  label, color, bg, onClick, disabled, loading,
}: {
  label: string;
  color: string;
  bg: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled ?? loading}
      style={{
        display: 'flex', minWidth: 0, alignItems: 'center', gap: 10,
        width: '100%', padding: '10px 14px', marginBottom: 6,
        border: `1px solid ${color}22`, borderRadius: 10, background: bg,
        color, fontWeight: 650, fontSize: 13, cursor: disabled ?? loading ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1, transition: 'opacity .15s',
        textAlign: 'left',
      }}
    >
      {loading ? (
        <span style={{ fontSize: 12 }}>⏳</span>
      ) : null}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MoreActionsPanel
// ─────────────────────────────────────────────────────────────────────────────
interface MoreActionsPanelProps {
  detail: DonationDetail;
  onClose: () => void;
  onRefund: () => void;
  onNote: () => void;
  onSpam: () => void;
  onReceipt: () => void;
  spamLoading: boolean;
  receiptLoading: boolean;
}

function MoreActionsPanel({
  detail, onClose, onRefund, onNote, onSpam, onReceipt, spamLoading, receiptLoading,
}: MoreActionsPanelProps) {
  useEscape(onClose);
  return (
    // Backdrop dismissal is supplementary; Escape and the close button remain available.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', minWidth: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ado-actions-panel">
        <div className="ado-panel-head">
          <span>More Actions</span>
          <button type="button" className="ado-close-btn" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <div className="ado-panel-section">Edit</div>
          <ActionItem
            label="Refund Donation"
            color="#ff3b5f" bg="#fff5f7"
            onClick={onRefund}
            disabled={detail.status === 'refunded'}
          />
          <ActionItem label="Add Note" color="#551cf2" bg="#f5f0ff" onClick={onNote} />
          <ActionItem
            label={detail.isSpam ? 'Unmark as Spam' : 'Mark as Spam'}
            color="#f97316" bg="#fff6ed"
            onClick={onSpam}
            loading={spamLoading}
          />

          <div className="ado-panel-divider" />
          <div className="ado-panel-section">Send</div>
          <ActionItem
            label={detail.receiptSentAt ? 'Resend Receipt' : 'Send Receipt'}
            color="#2563eb" bg="#eaf1ff"
            onClick={onReceipt}
            loading={receiptLoading}
          />

          <div className="ado-panel-divider" />
          <div className="ado-panel-section">Navigate</div>
          {detail.donorId && (
            <ActionItem
              label="View Donor Profile"
              color="#0fa456" bg="#e8f8ee"
              onClick={() => window.open(`/admin/users?id=${detail.donorId}`, '_blank')}
            />
          )}
          <ActionItem
            label="View Campaign"
            color="#6c35ff" bg="#f5f0ff"
            onClick={() => window.open(`/campaigns/${detail.campaignSlug}`, '_blank')}
          />

          <div className="ado-panel-divider" />
          <div className="ado-panel-section">Export</div>
          <ActionItem
            label="Export This Donation"
            color="#66708d" bg="#f4f5fa"
            onClick={() => window.open(`/api/admin/reports/export?type=donation&id=${detail.id}`, '_blank')}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RefundModal
// ─────────────────────────────────────────────────────────────────────────────
function RefundModal({
  detail,
  onClose,
  onSuccess,
}: {
  detail: DonationDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState((detail.amountCents / 100).toFixed(2));
  const [reason, setReason] = useState('Donor request');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  useEscape(onClose);

  async function handleRefund() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { setErr('Enter a valid refund amount.'); return; }
    const cents = Math.round(parsed * 100);
    if (cents > detail.amountCents) { setErr(`Cannot exceed ${fmtCents(detail.amountCents)}.`); return; }
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(`/api/admin/donations/${detail.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: cents, reason }),
      });
      const data: { error?: string; warning?: string } = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Refund failed');
      // The refund succeeded at Stripe but the ledger row was not written. Keep
      // the modal open on the warning instead of flashing the success state —
      // this is the one outcome that needs a human to follow up, and the retry
      // the admin would otherwise attempt would double-refund.
      if (data.warning) { setErr(data.warning); return; }
      onSuccess();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    // Backdrop dismissal is supplementary; Escape and the close button remain available.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="ado-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ado-modal">
        <div className="ado-modal-head">
          <h3>Process Refund</h3>
          <button type="button" className="ado-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="ado-modal-body">
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>
            Refunding donation of <strong>{fmtCents(detail.amountCents)}</strong> from{' '}
            <strong>{detail.donorName}</strong>. This action will be logged.
          </p>
          <div className="ado-field">
            <label htmlFor="ref-amount">Refund Amount ($)</label>
            <input
              id="ref-amount"
              className="ac-input"
              type="number"
              step="0.01"
              min="0.01"
              max={(detail.amountCents / 100).toFixed(2)}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <small style={{ color: 'var(--t3)', fontSize: 11 }}>Max: {fmtCents(detail.amountCents)}</small>
          </div>
          <div className="ado-field">
            <label htmlFor="ref-reason">Reason</label>
            <select id="ref-reason" className="ac-input" value={reason} onChange={e => setReason(e.target.value)}>
              <option>Donor request</option>
              <option>Duplicate charge</option>
              <option>Fraudulent</option>
              <option>Campaign cancelled</option>
              <option>Other</option>
            </select>
          </div>
          {err && <div className="ado-error">{err}</div>}
        </div>
        <div className="ado-modal-foot">
          <button type="button" className="kf-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="kf-danger" onClick={handleRefund} disabled={loading}>
            {loading ? 'Processing…' : 'Process Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NoteModal
// ─────────────────────────────────────────────────────────────────────────────
function NoteModal({
  detail,
  onClose,
  onSuccess,
}: {
  detail: DonationDetail;
  onClose: () => void;
  onSuccess: (note: string) => void;
}) {
  const [note, setNote] = useState(detail.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  useEscape(onClose);

  async function handleSave() {
    if (!note.trim()) { setErr('Note cannot be empty.'); return; }
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(`/api/admin/donations/${detail.id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note.trim() }),
      });
      const data: { error?: string } = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed to save note');
      onSuccess(note.trim());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    // Backdrop dismissal is supplementary; Escape and the close button remain available.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="ado-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ado-modal">
        <div className="ado-modal-head">
          <h3>Add / Edit Note</h3>
          <button type="button" className="ado-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="ado-modal-body">
          <div className="ado-field">
            <label htmlFor="ref-note">Internal Note</label>
            <textarea
              id="ref-note"
              className="ac-textarea"
              rows={5}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Enter internal note visible only to admins…"
            />
          </div>
          {err && <div className="ado-error">{err}</div>}
        </div>
        <div className="ado-modal-foot">
          <button type="button" className="kf-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="kf-primary" onClick={handleSave} disabled={loading || !note.trim()}>
            {loading ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SuccessView
// ─────────────────────────────────────────────────────────────────────────────
function SuccessView({
  type,
  donorName,
  amountCents,
  onBack,
  onViewAll,
}: {
  type: SuccessType;
  donorName: string;
  amountCents: number;
  onBack: () => void;
  onViewAll: () => void;
}) {
  const msgs: Record<SuccessType, { title: string; desc: string }> = {
    refund: {
      title: 'Refund Processed',
      desc: `${fmtCents(amountCents)} has been refunded to ${donorName}. The donation status has been updated.`,
    },
    note: {
      title: 'Note Saved',
      desc: 'Your internal note has been saved and is visible only to admins.',
    },
    receipt: {
      title: 'Receipt Sent',
      desc: `A donation receipt has been sent to ${donorName}.`,
    },
    spam: {
      title: 'Spam Status Updated',
      desc: `The spam status for this donation has been updated successfully.`,
    },
  };
  const m = msgs[type];
  return (
    <div className="ado-success-wrap">
      <div className="ado-success">
        <div className="ado-success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={36} height={36}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2>{m.title}</h2>
        <p>{m.desc}</p>
        <div className="ado-success-btns">
          <button type="button" className="kf-primary" onClick={onBack}>← Back to Donation</button>
          <button type="button" className="kf-outline" onClick={onViewAll}>View All Donations</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailView
// ─────────────────────────────────────────────────────────────────────────────
function DetailView({
  initialDetail,
  onBack,
  onRefresh,
}: {
  initialDetail: DonationDetail;
  onBack: () => void;
  onRefresh: (id: string) => void;
}) {
  const [detail, setDetail] = useState<DonationDetail>(initialDetail);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [spamLoading, setSpamLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [successType, setSuccessType] = useState<SuccessType | null>(null);
  const [actionErr, setActionErr] = useState('');

  async function handleToggleSpam() {
    setSpamLoading(true);
    setActionErr('');
    try {
      const r = await fetch(`/api/admin/donations/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_spam: !detail.isSpam }),
      });
      const data: { error?: string } = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed to update spam status');
      setDetail(d => ({ ...d, isSpam: !d.isSpam }));
      setShowMoreActions(false);
      setSuccessType('spam');
    } catch (e) {
      setActionErr((e as Error).message);
    } finally {
      setSpamLoading(false);
    }
  }

  async function handleSendReceipt() {
    setReceiptLoading(true);
    setActionErr('');
    try {
      const r = await fetch(`/api/admin/donations/${detail.id}/receipt`, { method: 'POST' });
      const data: { error?: string } = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed to send receipt');
      const now = new Date().toISOString();
      setDetail(d => ({ ...d, receiptSentAt: now }));
      setShowMoreActions(false);
      setSuccessType('receipt');
    } catch (e) {
      setActionErr((e as Error).message);
    } finally {
      setReceiptLoading(false);
    }
  }

  function handleRefundSuccess() {
    setShowRefundModal(false);
    setDetail(d => ({ ...d, status: 'refunded', refundedAt: new Date().toISOString() }));
    setSuccessType('refund');
  }

  function handleNoteSuccess(note: string) {
    setDetail(d => ({ ...d, notes: note }));
    setShowNoteModal(false);
    setSuccessType('note');
  }

  if (successType) {
    return (
      <SuccessView
        type={successType}
        donorName={detail.donorName}
        amountCents={detail.amountCents}
        onBack={() => { setSuccessType(null); onRefresh(detail.id); }}
        onViewAll={onBack}
      />
    );
  }

  // Build timeline
  type TimelineEvent = { event: string; date: string; color: string };
  const timeline: TimelineEvent[] = [
    { event: 'Donation Received', date: detail.createdAt, color: '#0fa456' },
    ...(detail.status === 'completed' ? [{ event: 'Payment Confirmed', date: detail.createdAt, color: '#2563eb' }] : []),
    ...(detail.status === 'failed' ? [{ event: 'Payment Failed', date: detail.createdAt, color: 'var(--red-text)' }] : []),
    ...(detail.receiptSentAt ? [{ event: 'Receipt Sent', date: detail.receiptSentAt, color: '#2563eb' }] : []),
    ...(detail.refundedAt ? [{ event: `Refund Processed — ${detail.refundReason ?? ''}`.trim().replace(/ —$/, ''), date: detail.refundedAt, color: 'var(--red-text)' }] : []),
    ...(detail.isSpam ? [{ event: 'Marked as Spam', date: detail.createdAt, color: 'var(--orange-text)' }] : []),
    ...detail.auditLog.map(a => ({ event: auditActionLabel(a.action), date: a.createdAt, color: auditActionColor(a.action) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div style={{ padding: '0 32px 48px' }}>
      {/* Header bar */}
      <div className="ado-detail-bar">
        <button type="button" className="ado-back-btn" onClick={onBack}>
          ← Donations
        </button>
        <span className="ado-detail-id">
          {detail.id.slice(0, 8).toUpperCase()}
        </span>
        <button
          type="button"
          className="kf-outline"
          style={{ height: 38, padding: '0 18px', fontSize: 13 }}
          onClick={() => setShowMoreActions(true)}
        >
          More Actions ▾
        </button>
      </div>

      {actionErr && (
        <div className="ado-error" style={{ marginBottom: 16 }}>{actionErr}</div>
      )}

      {/* Donor hero row */}
      <div className="ado-donor-row kf-card">
        <div className="ado-donor-avatar">{detail.donorName.charAt(0).toUpperCase()}</div>
        <div className="ado-donor-info">
          <strong>{detail.donorName}</strong>
          {detail.donorEmail && <span>{detail.donorEmail}</span>}
          {detail.anonymous && <span style={{ color: 'var(--t3)', fontSize: 11, fontStyle: 'italic' }}>Anonymous donation</span>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', minWidth: 0, alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.02em', lineHeight: 1 }}>
              {fmtCents(detail.amountCents)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>{fmtDateTime(detail.createdAt)}</div>
          </div>
          <StatusPill status={detail.status} />
          {detail.status !== 'refunded' && (
            <button
              type="button"
              className="kf-danger"
              style={{ height: 40, padding: '0 20px', fontSize: 13, fontWeight: 700, borderRadius: 10 }}
              onClick={() => setShowRefundModal(true)}
            >
              Refund
            </button>
          )}
        </div>
      </div>

      {/* Two-column detail grid */}
      <div className="ado-detail-grid">
        {/* Left: info cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Donation Information */}
          <section className="kf-card">
            <div className="kf-card-head"><h2>Donation Information</h2></div>
            <div style={{ padding: '0 20px 20px' }}>
              {([
                ['Amount', fmtCents(detail.amountCents)],
                ['Status', capitalize(detail.status)],
                ['Campaign', detail.campaignTitle],
                ['Payment Method', detail.paymentMethod ?? 'Card'],
                ['Source', detail.source ?? 'Web'],
                ['Date', fmtDateTime(detail.createdAt)],
                ['Stripe Payment ID', detail.stripePaymentIntentId ?? 'N/A'],
                ['Donation ID', detail.id],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="ado-info-row">
                  <span className="ado-info-label">{label}</span>
                  <span
                    className="ado-info-val"
                    style={{ fontFamily: (label === 'Donation ID' || label === 'Stripe Payment ID') ? 'monospace' : 'inherit', fontSize: label === 'Donation ID' ? 11 : 13 }}
                  >
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Additional Details */}
          <section className="kf-card">
            <div className="kf-card-head"><h2>Additional Details</h2></div>
            <div style={{ padding: '0 20px 20px' }}>
              {([
                ['Anonymous', detail.anonymous ? 'Yes' : 'No'],
                ['Message', detail.message || '—'],
                ['Internal Notes', detail.notes || '—'],
                ['Marked as Spam', detail.isSpam ? 'Yes' : 'No'],
                ['Receipt Sent', detail.receiptSentAt ? fmtDate(detail.receiptSentAt) : 'No'],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="ado-info-row">
                  <span className="ado-info-label">{label}</span>
                  <span
                    className="ado-info-val"
                    style={{ color: label === 'Marked as Spam' && detail.isSpam ? 'var(--orange-text)' : undefined }}
                  >
                    {val}
                  </span>
                </div>
              ))}
              {detail.refundedAt && (
                <>
                  <div className="ado-info-row">
                    <span className="ado-info-label">Refunded At</span>
                    <span className="ado-info-val">{fmtDate(detail.refundedAt)}</span>
                  </div>
                  <div className="ado-info-row">
                    <span className="ado-info-label">Refund Reason</span>
                    <span className="ado-info-val">{detail.refundReason ?? '—'}</span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Right: History timeline */}
        <section className="kf-card" style={{ alignSelf: 'flex-start' }}>
          <div className="kf-card-head"><h2>History</h2></div>
          <div style={{ padding: '4px 20px 20px' }}>
            {timeline.length === 0 ? (
              <p style={{ color: 'var(--t3)', fontSize: 13, margin: '16px 0 0' }}>No history available.</p>
            ) : (
              <div className="ado-timeline">
                {timeline.map((ev, i) => (
                  <div key={i} className="ado-timeline-item">
                    <div className="ado-timeline-left">
                      <div className="ado-timeline-dot" style={{ background: ev.color }} />
                      {i < timeline.length - 1 && <div className="ado-timeline-line-seg" />}
                    </div>
                    <div style={{ paddingBottom: i < timeline.length - 1 ? 20 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--t1)' }}>{ev.event}</div>
                      <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{fmtDateTime(ev.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* More Actions slide-in */}
      {showMoreActions && (
        <MoreActionsPanel
          detail={detail}
          onClose={() => setShowMoreActions(false)}
          onRefund={() => { setShowMoreActions(false); setShowRefundModal(true); }}
          onNote={() => { setShowMoreActions(false); setShowNoteModal(true); }}
          onSpam={handleToggleSpam}
          onReceipt={handleSendReceipt}
          spamLoading={spamLoading}
          receiptLoading={receiptLoading}
        />
      )}

      {/* Refund modal */}
      {showRefundModal && (
        <RefundModal
          detail={detail}
          onClose={() => setShowRefundModal(false)}
          onSuccess={handleRefundSuccess}
        />
      )}

      {/* Note modal */}
      {showNoteModal && (
        <NoteModal
          detail={detail}
          onClose={() => setShowNoteModal(false)}
          onSuccess={handleNoteSuccess}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function DonationsClient({
  totalCents,
  donorCount,
  avgCents,
  totalDonationCount,
  completedCount,
  pendingCount,
  refundedCount,
  failedCount,
  donations,
  weeklyTrend,
  campaignVolumes,
  topDonors,
}: DonationsClientProps) {
  // View state
  const [viewState, setViewState] = useState<ViewState>('overview');
  const [detail, setDetail] = useState<DonationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Overview panel tabs
  const [panelTab, setPanelTab] = useState('Donations');
  const panelTabs = ['Donations', 'Donors', 'Recurring', 'Refunds', 'Reports', 'Export', 'Audit'];

  // List / filter state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  // These two used to be unbound <select>s whose value was never read.
  const [exportDataType, setExportDataType] = useState('all');
  const [exportRange, setExportRange] = useState('all');
  const [exportError, setExportError] = useState<string | null>(null);

  // Rewritten: the previous handler POSTed `{ format, type: 'donations' }`, but the
  // endpoint requires `reportId` and 400s without it — and the response was piped
  // straight into a Blob download, so an admin clicking Export received a file named
  // `donations.csv` whose contents were `{"error":"reportId is required"}`. It also
  // ignored the Data Type and Date Range pickers entirely.
  const EXPORT_SINCE: Record<string, () => string | undefined> = {
    all: () => undefined,
    '30d': () => new Date(Date.now() - 30 * 864e5).toISOString(),
    '90d': () => new Date(Date.now() - 90 * 864e5).toISOString(),
    ytd: () => new Date(new Date().getFullYear(), 0, 1).toISOString(),
  };

  async function runExport() {
    setExportError(null);
    // "Donors" is a different report entirely; the rest are donation rows filtered
    // by status, where "All Donations" means no status filter.
    const isDonors = exportDataType === 'donors';
    const payload: Record<string, string> = {
      reportId: isDonors ? 'top-donors' : 'donation-summary',
    };
    if (!isDonors) payload.status = exportDataType === 'all' ? 'all' : exportDataType;
    const since = EXPORT_SINCE[exportRange]?.();
    if (since) payload.since = since;

    try {
      const res = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Never hand the user a "CSV" that is actually an error body.
        const detail = await res.json().catch(() => ({}));
        setExportError((detail as { error?: string }).error ?? `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${isDonors ? 'donors' : 'donations'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Network error — the export did not download.');
    }
  }

  const PAGE_SIZE = 10;

  // ── Fetch detail ────────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const r = await fetch(`/api/admin/donations/${id}`);
      const data: DonationDetail & { error?: string } = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed to load donation');
      setDetail(data);
      setViewState('detail');
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Filter / paginate donations ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = donations;
    if (filterStatus !== 'all') list = list.filter(d => d.status.toLowerCase() === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        d =>
          d.donor_name.toLowerCase().includes(q) ||
          d.donor_email.toLowerCase().includes(q) ||
          d.campaign_title.toLowerCase().includes(q),
      );
    }
    return list;
  }, [donations, filterStatus, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusTabs = [
    { id: 'all', label: `All (${totalDonationCount})` },
    { id: 'completed', label: `Completed (${completedCount})` },
    { id: 'pending', label: `Pending (${pendingCount})` },
    { id: 'refunded', label: `Refunded (${refundedCount})` },
    { id: 'failed', label: `Failed (${failedCount})` },
  ];

  // ── Chart helpers ───────────────────────────────────────────────────────────
  const top5 = campaignVolumes.slice(0, 5);
  const othersTotal = campaignVolumes.slice(5).reduce((s, c) => s + c.total_cents, 0);
  const campaignTotal = Math.max(campaignVolumes.reduce((s, c) => s + c.total_cents, 0), 1);

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (viewState === 'detail') {
    if (detailLoading) {
      return (
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--t3)', fontSize: 14 }}>
          Loading donation…
        </div>
      );
    }
    if (detailError) {
      return (
        <div style={{ padding: '40px 32px' }}>
          <div className="ado-error">{detailError}</div>
          <button type="button" className="kf-outline" style={{ marginTop: 16 }} onClick={() => setViewState('overview')}>← Back</button>
        </div>
      );
    }
    if (detail) {
      return (
        <DetailView
          initialDetail={detail}
          onBack={() => { setViewState('overview'); setDetail(null); }}
          onRefresh={fetchDetail}
        />
      );
    }
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 32px 40px' }}>
      {detailLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'grid', placeItems: 'center', background: 'rgba(10,15,60,.25)', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: '28px 40px', fontSize: 14, color: 'var(--t1)', fontWeight: 600 }}>Loading donation…</div>
        </div>
      )}

      {/* KPI row */}
      <div className="kf-metrics" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Raised', value: fmtCents(totalCents), change: 'Completed donations', icon: 'gift', tone: 'violet' },
          { label: 'Total Donors', value: donorCount.toLocaleString(), change: 'Unique donors', icon: 'users', tone: 'green' },
          { label: 'Average Donation', value: fmtCents(avgCents), change: 'Per completed tx', icon: 'chart', tone: 'blue' },
          { label: 'Total Count', value: totalDonationCount.toLocaleString(), change: 'All donations', icon: 'check', tone: 'orange' },
        ].map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22} strokeLinecap="round" strokeLinejoin="round">
                {m.icon === 'gift' && <><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2-4L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2-4L12 7Z"/></>}
                {m.icon === 'users' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}
                {m.icon === 'chart' && <><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></>}
                {m.icon === 'check' && <path d="M20 6L9 17l-5-5"/>}
              </svg>
            </div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
              <small>{m.change}</small>
            </div>
          </article>
        ))}
      </div>

      {/* Charts row */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card kf-chart">
          <div className="kf-card-head">
            <h2>Donation Trend</h2>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>Last 8 weeks</span>
          </div>
          <div style={{ padding: '0 18px 12px' }}>
            <TrendLine points={weeklyTrend} />
          </div>
        </section>
        <section className="kf-card">
          <div className="kf-card-head"><h2>Donations by Campaign</h2></div>
          <div style={{ padding: '0 20px 20px' }}>
            <DonutChart slices={[
              ...top5.map((c, idx) => ({
                label: c.campaign_title.slice(0, 20) + (c.campaign_title.length > 20 ? '…' : ''),
                value: Math.round(c.total_cents / 100),
                color: (['var(--brand-text)', '#ec3fb4', '#2f80ed', '#19b86a', '#f59e0b'] as string[])[idx % 5],
              })),
              ...(othersTotal > 0 ? [{ label: 'Others', value: Math.round(othersTotal / 100), color: '#a9afc2' }] : []),
            ]} />
            <div style={{ marginTop: 12 }}>
              {top5.map(c => (
                <div key={c.campaign_id} style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <span style={{ color: 'var(--t1)', fontWeight: 700 }}>{c.campaign_title.slice(0, 28)}</span>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: 'var(--t1)' }}>{fmtCents(c.total_cents)}</strong>
                    <span style={{ color: 'var(--t3)', fontSize: 11, marginLeft: 6 }}>{Math.round((c.total_cents / campaignTotal) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Recent donations + Top donors */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card">
          <div className="kf-card-head"><h2>Recent Donations</h2></div>
          {donations.slice(0, 5).map(d => (
            <div
              key={d.id}
              style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer' }}
              onClick={() => { fetchDetail(d.id); }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  fetchDetail(d.id);
                }
              }}
              role="button"
              tabIndex={0}
              onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {d.donor_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.donor_name}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.campaign_title}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{fmtCents(d.amount_cents)}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDate(d.created_at)}</div>
              </div>
            </div>
          ))}
          <div style={{ height: 48, display: 'grid', placeItems: 'center', borderTop: '1px solid #f0f2f8' }}>
            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--brand-text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              onClick={() => setPanelTab('Donations')}>
              View all donations →
            </button>
          </div>
        </section>
        <section className="kf-card">
          <div className="kf-card-head"><h2>Top Donors</h2></div>
          {topDonors.slice(0, 5).map((d, i) => (
            <div key={d.donor_id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f0f2f8' }}>
              <span style={{ width: 22, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>{i + 1}</span>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {d.donor_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--t1)' }}>{d.donor_name}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{d.donation_count} donation{d.donation_count !== 1 ? 's' : ''}</div>
              </div>
              <strong style={{ fontSize: 15, color: 'var(--t1)' }}>{fmtCents(d.total_cents)}</strong>
            </div>
          ))}
          {topDonors.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>No donors yet</div>
          )}
        </section>
      </div>

      {/* Main tabbed section */}
      <section className="kf-card" style={{ marginBottom: 24 }}>
        {/* Panel tabs */}
        <div style={{ display: 'flex', minWidth: 0, gap: 0, borderBottom: '1px solid #eef0f7', overflowX: 'auto', padding: '0 20px' }}>
          {panelTabs.map(t => (
            <button key={t} type="button" onClick={() => setPanelTab(t)}
              style={{
                height: 50, padding: '0 16px', border: 0,
                borderBottom: `2px solid ${panelTab === t ? '#6c35ff' : 'transparent'}`,
                background: 'none', fontWeight: panelTab === t ? 950 : 750, fontSize: 13,
                color: panelTab === t ? 'var(--brand-text)' : 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Donations tab ─────────────────────────────────────────────────── */}
        {panelTab === 'Donations' && (
          <div>
            <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #eef0f7', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', background: 'var(--s1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2} width={16} height={16} aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search by donor, email, or campaign…"
                  aria-label="Search donations by donor, email, or campaign"
                  style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, width: '100%' }}
                />
              </div>
              <select aria-label="Filter by donation status" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
                style={{ height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', fontSize: 13, background: 'var(--s1)' }}>
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
              {/* Was window.open(...) on a GET URL, but the export route only
                  implements POST — this opened a tab showing 405, not a download. */}
              <button type="button"
                style={{ height: 42, padding: '0 18px', border: '1px solid #e0e4ef', borderRadius: 9, background: 'var(--s1)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => void runExport()}>
                Export
              </button>
            </div>

            {/* Status sub-tabs */}
            <div style={{ display: 'flex', minWidth: 0, gap: 0, padding: '0 20px', borderBottom: '1px solid #eef0f7' }}>
              {statusTabs.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { setFilterStatus(t.id); setPage(0); }}
                  style={{
                    height: 44, padding: '0 14px', border: 0,
                    borderBottom: `2px solid ${filterStatus === t.id ? '#6c35ff' : 'transparent'}`,
                    background: 'none', fontWeight: filterStatus === t.id ? 950 : 700, fontSize: 12,
                    color: filterStatus === t.id ? 'var(--brand-text)' : 'var(--t3)', cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 120px) minmax(0, 120px) minmax(0, 130px)', gap: 12, padding: '10px 20px', background: 'var(--s2)', borderBottom: '1px solid #eef0f7', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Donor</span><span>Campaign</span><span>Amount</span><span>Status</span><span>Date</span>
            </div>

            {/* Table rows */}
            {currentPage.map(d => (
              <div
                key={d.id}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 120px) minmax(0, 120px) minmax(0, 130px)', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer', alignItems: 'center' }}
                onClick={() => { fetchDetail(d.id); }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fetchDetail(d.id);
                  }
                }}
                role="button"
                tabIndex={0}
                onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {d.donor_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--t1)' }}>{d.donor_name}</div>
                    {d.donor_email && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{d.donor_email}</div>}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.campaign_title}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{fmtCents(d.amount_cents)}</div>
                <StatusPill status={d.status} />
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{fmtDate(d.created_at)}</div>
              </div>
            ))}

            {currentPage.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>No donations found</div>
            )}

            {/* Pagination */}
            <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #eef0f7' }}>
              <span style={{ fontSize: 13, color: 'var(--t3)' }}>
                Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', minWidth: 0, gap: 6 }}>
                <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: 'var(--s1)', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}>
                  ← Prev
                </button>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
                  style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: 'var(--s1)', cursor: page >= pages - 1 ? 'default' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, fontSize: 13 }}>
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Donors tab ──────────────────────────────────────────────────────── */}
        {panelTab === 'Donors' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>All Donors</h3>
            {topDonors.length === 0 && (
              <p style={{ color: 'var(--t3)', fontSize: 14 }}>No donor data available.</p>
            )}
            <div style={{ border: '1px solid #e6e9f2', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr minmax(0, 1fr) minmax(0, 1fr)', gap: 12, padding: '10px 18px', background: 'var(--s2)', borderBottom: '1px solid #e6e9f2', color: 'var(--t3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <span>Donor</span><span>Total Donated</span><span>Donations</span><span>Avg / Gift</span>
              </div>
              {topDonors.slice(0, 20).map((d, i) => (
                <div key={d.donor_id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr minmax(0, 1fr) minmax(0, 1fr)', gap: 12, padding: '14px 18px', alignItems: 'center', borderBottom: i < topDonors.length - 1 ? '1px solid #f0f2f8' : 'none', background: 'var(--s1)' }}>
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: i < 3 ? 'var(--brand-text)' : 'var(--t3)', textAlign: 'center' }}>#{i + 1}</span>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {d.donor_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--t1)' }}>{d.donor_name}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-text)' }}>{fmtCents(d.total_cents)}</div>
                  <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600 }}>{d.donation_count}×</div>
                  <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600 }}>{fmtCents(Math.round(d.total_cents / d.donation_count))}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recurring tab ──────────────────────────────────────────────────── */}
        {panelTab === 'Recurring' && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Recurring', value: topDonors.filter(d => d.donation_count >= 2).length, color: 'var(--brand-text)' },
                { label: 'Active', value: completedCount, color: 'var(--green-text)' },
                { label: 'Pending', value: pendingCount, color: 'var(--orange-text)' },
                { label: 'Refunded', value: refundedCount, color: 'var(--red-text)' },
              ].map(s => (
                <div key={s.label} style={{ padding: '18px', border: '1px solid #e6e9f2', borderRadius: 12, background: 'var(--s1)' }}>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 6, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {(() => {
              const recurring = topDonors.filter(d => d.donation_count >= 2);
              if (recurring.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t3)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--tint-violet)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--brand-text)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={24} height={24} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                        <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                      </svg>
                    </div>
                    <strong style={{ display: 'block', color: 'var(--t1)', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No recurring donors found</strong>
                    <span style={{ fontSize: 13 }}>Donors who give more than once will appear here.</span>
                  </div>
                );
              }
              return (
                <div style={{ border: '1px solid #e6e9f2', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr minmax(0, 1fr) .9fr .9fr', gap: 12, padding: '10px 18px', background: 'var(--s2)', borderBottom: '1px solid #e6e9f2', color: 'var(--t3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <span>Donor</span><span>Total Donated</span><span>Donations</span><span>Avg / Gift</span><span>Status</span>
                  </div>
                  {recurring.map((d, i) => (
                    <div key={d.donor_id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr minmax(0, 1fr) .9fr .9fr', gap: 12, padding: '14px 18px', alignItems: 'center', borderBottom: i < recurring.length - 1 ? '1px solid #f0f2f8' : 'none', background: 'var(--s1)' }}>
                      <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--t1)' }}>{d.donor_name}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-text)' }}>{fmtCents(d.total_cents)}</div>
                      <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600 }}>{d.donation_count}×</div>
                      <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600 }}>{fmtCents(Math.round(d.total_cents / d.donation_count))}</div>
                      <span className="kf-pill green">Active</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Refunds tab ────────────────────────────────────────────────────── */}
        {panelTab === 'Refunds' && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Refunded Donations</h3>
              <span className="kf-pill red">{refundedCount} refunded</span>
            </div>
            {donations.filter(d => d.status === 'refunded').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: 14 }}>No refunded donations.</div>
            ) : (
              <div style={{ border: '1px solid #e6e9f2', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 120px) minmax(0, 130px)', gap: 12, padding: '10px 18px', background: 'var(--s2)', borderBottom: '1px solid #e6e9f2', color: 'var(--t3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <span>Donor</span><span>Campaign</span><span>Amount</span><span>Date</span>
                </div>
                {donations.filter(d => d.status === 'refunded').map((d, i, arr) => (
                  <div key={d.id}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 120px) minmax(0, 130px)', gap: 12, padding: '14px 18px', alignItems: 'center', borderBottom: i < arr.length - 1 ? '1px solid #f0f2f8' : 'none', background: 'var(--s1)', cursor: 'pointer' }}
                    onClick={() => { fetchDetail(d.id); }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fetchDetail(d.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fff5f7')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--t1)' }}>{d.donor_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 700 }}>{d.campaign_title}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red-text)' }}>{fmtCents(d.amount_cents)}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{fmtDate(d.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Reports tab ───────────────────────────────────────────────────── */}
        {panelTab === 'Reports' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Reports & Analytics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              {[
                { label: 'Donation Summary', desc: 'All donations with status breakdown', icon: '📊' },
                { label: 'Donor Insights', desc: 'Top donors & retention metrics', icon: '👥' },
                { label: 'Campaign Performance', desc: 'Revenue per campaign', icon: '🎯' },
                { label: 'Payment Methods', desc: 'Breakdown by payment type', icon: '💳' },
                { label: 'Monthly Trends', desc: 'Month-over-month donation trends', icon: '📈' },
                { label: 'Custom Report', desc: 'Filter and export custom data', icon: '⚙️' },
              ].map(r => (
                <button key={r.label} type="button"
                  style={{ padding: '18px', border: '1px solid #e6e9f2', borderRadius: 12, background: 'var(--s1)', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => window.open(`/api/admin/reports/export?type=${r.label.toLowerCase().replace(/ /g, '_')}`, '_blank')}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{r.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--t1)', marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Export tab ────────────────────────────────────────────────────── */}
        {panelTab === 'Export' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Export Data</h3>
            <div style={{ maxWidth: 460, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
              <div className="ado-field">
                <label htmlFor="exp-datatype">Data Type</label>
                <select id="exp-datatype" className="ac-input" value={exportDataType} onChange={e => setExportDataType(e.target.value)}>
                  <option value="all">All Donations</option>
                  <option value="completed">Completed Only</option>
                  <option value="refunded">Refunded Only</option>
                  <option value="donors">Donors</option>
                </select>
              </div>
              {/* No Format control. Excel and PDF were removed earlier because
                  the endpoint only produces CSV — picking PDF downloaded a CSV
                  named ".pdf". That left a select with ONE option whose value
                  nothing read: `exportFormat` was declared and rendered and
                  referenced nowhere else, so the export ignored it either way.
                  A control offering no choice is not a choice; exports are CSV. */}
              <div className="ado-field">
                <label htmlFor="exp-daterange">Date Range</label>
                <select id="exp-daterange" className="ac-input" value={exportRange} onChange={e => setExportRange(e.target.value)}>
                  <option value="all">All time</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="ytd">This year</option>
                </select>
              </div>
              <button type="button" className="kf-primary"
                style={{ height: 44, fontSize: 14, fontWeight: 700 }}
                onClick={() => void runExport()}>
                Export Donations
              </button>
              {exportError && (
                <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--red-text, #be123c)' }}>
                  {exportError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Audit tab ─────────────────────────────────────────────────────── */}
        {panelTab === 'Audit' && (
          <AuditTab />
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuditTab — fetches real audit log for donations
// ─────────────────────────────────────────────────────────────────────────────
function AuditTab() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/audit?target_type=donation&limit=50')
      .then(r => r.json())
      .then((data: AuditEntry[] | { error?: string }) => {
        if ('error' in data) throw new Error(data.error);
        setEntries(data as AuditEntry[]);
      })
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '32px 20px', color: 'var(--t3)', fontSize: 14 }}>Loading audit log…</div>;
  if (err) return <div style={{ padding: '20px' }} className="ado-error">{err}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Audit Log</h3>
      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: 14 }}>No audit entries yet.</div>
      ) : (
        entries.map(e => (
          <div key={e.id} style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 14, padding: '12px 0', borderBottom: '1px solid #f0f2f8' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: auditActionColor(e.action), marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--t1)' }}>{auditActionLabel(e.action)}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>by {e.actorName}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--t3)', flexShrink: 0 }}>{fmtDateTime(e.createdAt)}</span>
          </div>
        ))
      )}
    </div>
  );
}
