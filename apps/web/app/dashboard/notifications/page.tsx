'use client';

import React, { useEffect, useState } from 'react';
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
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
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

const KIND_LABEL: Record<string, string> = {
  donation_received:    'Donation',
  payout_paid:         'Payout',
  payout_failed:       'Payout',
  payout_scheduled:    'Payout',
  refund_processed:    'Refund',
  beneficiary_invited: 'Invite',
  co_organizer_invited:'Invite',
  campaign_update:     'Update',
  trust_report:        'Trust',
  campaign_paused:     'Campaign',
  campaign_suspended:  'Campaign',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/notifications?limit=100');
        const d: { notifications?: Notification[] } = r.ok ? await r.json() : { notifications: [] };
        if (active) setNotifications(d.notifications ?? []);
      } catch { /* non-fatal */ } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' });
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
    );
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
    );
  };

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.read_at)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" style={{ color: 'var(--t3, var(--t3))', fontSize: 13, textDecoration: 'none' }}>← Dashboard</Link>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', margin: '8px 0 0' }}>
            Notifications
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 10, background: 'var(--violet, var(--violet))', color: '#fff',
                fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                verticalAlign: 'middle',
              }}>
                {unreadCount}
              </span>
            )}
          </h1>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              background: 'none', border: '1.5px solid var(--violet, var(--violet))',
              color: 'var(--violet, var(--violet))', fontWeight: 700, fontSize: 13,
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1.5px solid var(--b1, var(--s2))', paddingBottom: 0 }}>
        {(['all', 'unread'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: filter === tab ? 800 : 500,
              color: filter === tab ? 'var(--violet, var(--violet))' : 'var(--t3, var(--t3))',
              fontSize: 14, padding: '8px 16px',
              borderBottom: filter === tab ? '2px solid var(--violet, var(--violet))' : '2px solid transparent',
              marginBottom: -1.5, transition: 'color .15s',
              textTransform: 'capitalize',
            }}
          >
            {tab}{tab === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--t3, var(--t3))' }}>Loading…</div>
      )}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1, var(--t1))', marginBottom: 6 }}>
            {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--t3, var(--t3))' }}>
            {filter === 'unread'
              ? 'You have no unread notifications.'
              : 'Notifications about your campaigns will appear here.'}
          </div>
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayed.map(n => (
            <div
              key={n.id}
              onClick={() => { void markRead(n.id); if (n.link) window.location.href = n.link; }}
              style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '16px 18px', borderRadius: 12, cursor: n.link ? 'pointer' : 'default',
                background: n.read_at ? 'var(--s1, #fff)' : 'var(--s2, rgba(109,53,255,.08))',
                border: '1px solid',
                borderColor: n.read_at ? 'var(--b1, var(--s2))' : 'var(--b2, var(--b2))',
                transition: 'background .15s',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: 'var(--s3, rgba(109,53,255,.08))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>
                {KIND_ICON[n.kind] ?? '🔔'}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--violet, var(--violet))',
                    background: 'var(--s3, rgba(109,53,255,.18))', padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {KIND_LABEL[n.kind] ?? 'Info'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--t3, var(--t3))', flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: n.read_at ? 600 : 800, color: 'var(--t1, var(--t1))', lineHeight: 1.4 }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{ fontSize: 13, color: 'var(--t3, var(--t3))', marginTop: 3, lineHeight: 1.5 }}>
                    {n.body}
                  </div>
                )}
              </div>

              {/* Right side */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                {!n.read_at && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--violet, var(--violet))' }} />
                )}
                <button
                  onClick={e => void deleteNotif(n.id, e)}
                  aria-label="Dismiss"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--t4, var(--b1))', fontSize: 16, padding: 0, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
