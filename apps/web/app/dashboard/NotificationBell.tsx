'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const KIND_ICON: Record<string, string> = {
  donation_received:    '💰',
  payout_paid:         '💸',
  payout_failed:       '⚠️',
  payout_scheduled:    '📅',
  refund_processed:    '↩️',
  beneficiary_invited: '✉️',
  co_organizer_invited:'👥',
  campaign_update:     '📣',
  trust_report:        '🛡️',
  campaign_paused:     '⏸️',
  campaign_suspended:  '🚫',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    setLoading(true);
    fetch('/api/notifications?limit=10')
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then((d: { notifications?: Notification[] }) => {
        const notifs = d.notifications ?? [];
        setNotifications(notifs);
        setUnread(notifs.filter(n => !n.read_at).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/notifications?limit=10');
        const d: { notifications?: Notification[] } = r.ok ? await r.json() : { notifications: [] };
        if (!active) return;
        const notifs = d.notifications ?? [];
        setNotifications(notifs);
        setUnread(notifs.filter(n => !n.read_at).length);
      } catch { /* non-fatal */ } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' });
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="dash-bell"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        style={{ position: 'relative' }}
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--red, #ef4444)', color: '#fff',
            fontSize: 9, fontWeight: 900, lineHeight: 1,
            padding: '2px 4px', borderRadius: 8,
            minWidth: 14, textAlign: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="kf-modal-responsive" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340, background: 'var(--s1, #fff)', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,.18)', zIndex: 9999,
          border: '1px solid var(--b1, #e8e8f0)', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--b1, #f0f0f8)' }}>
            <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--t1, #1a1a2e)' }}>Notifications</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--violet, #6c35ff)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  Mark all read
                </button>
              )}
              <Link href="/dashboard/notifications" style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', fontWeight: 600, textDecoration: 'none' }} onClick={() => setOpen(false)}>
                See all
              </Link>
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--t3, #94a3b8)', fontSize: 13 }}>Loading…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                <div style={{ fontSize: 13, color: 'var(--t3, #94a3b8)' }}>No notifications yet</div>
              </div>
            )}
            {!loading && notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { markRead(n.id); if (n.link) window.location.href = n.link; setOpen(false); }}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '12px 16px', cursor: 'pointer',
                  background: n.read_at ? 'var(--s1, #fff)' : 'var(--s2, #f5f0ff)',
                  borderBottom: '1px solid var(--b1, #f5f5fa)',
                  transition: 'background .1s',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{KIND_ICON[n.kind] ?? '🔔'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read_at ? 600 : 900, color: 'var(--t1, #1a1a2e)', lineHeight: 1.4 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: 'var(--t3, #64748b)', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.read_at && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--violet, #6c35ff)', flexShrink: 0, marginTop: 6 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
