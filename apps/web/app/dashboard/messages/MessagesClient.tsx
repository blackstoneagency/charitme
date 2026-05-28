'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────
// Types (plain, serializable — passed from server)
// ─────────────────────────────────────────────
export type ThreadMessage = {
  id: string;
  campaign_id: string;
  message: string;
  created_at: string;
};

export type OwnerReply = {
  id: string;
  message: string;
  created_at: string;
};

export type Thread = {
  donorId: string;
  donorName: string;
  messages: ThreadMessage[];
  campaignIds: string[];
};

export type MessagesClientProps = {
  threads: Thread[];
  campaignMap: Record<string, string>;
  replies: Record<string, OwnerReply[]>; // keyed by donor_message_id
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  const now = Date.now();
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function avatarInitials(name: string): string {
  return name.split(/\s+/).map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

const COLORS = ['#6c35ff', '#19b86a', '#2f80ed', '#ec3fb4', '#f59e0b'];

function Avatar({ name, idx }: { name: string; idx: number }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: COLORS[idx % COLORS.length],
      color: '#fff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 13, fontWeight: 700,
      flexShrink: 0,
    }}>
      {avatarInitials(name)}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────
export default function MessagesClient({ threads, campaignMap, replies }: MessagesClientProps) {
  // Track active thread by donorId instead of index — survives filter changes gracefully
  const [activeDonorId, setActiveDonorId] = useState<string | null>(threads[0]?.donorId ?? null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'inbox' | 'unread' | 'archived'>('inbox');
  const [compose, setCompose] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sentReplies, setSentReplies] = useState<OwnerReply[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Filter threads based on search
  const filtered = threads.filter(t =>
    search.trim() === '' ||
    t.donorName.toLowerCase().includes(search.toLowerCase()) ||
    t.messages.some(m => m.message.toLowerCase().includes(search.toLowerCase()))
  );

  // Derive active thread — falls back to first filtered item if active donor not in results
  const activeThread = filtered.find(t => t.donorId === activeDonorId) ?? filtered[0] ?? null;

  // Select a thread by donorId
  const selectThread = useCallback((donorId: string) => {
    setActiveDonorId(donorId);
    setSentReplies([]); // clear local sent replies when switching thread
    setSendError('');
  }, []);

  // Scroll to bottom of thread when active thread changes or new reply is sent
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.donorId, sentReplies.length]);

  async function handleSend() {
    if (!compose.trim() || !activeThread) return;
    setSending(true);
    setSendError('');
    try {
      const campaignId = activeThread.campaignIds[0];
      const latestMessage = activeThread.messages[0];
      const res = await fetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          donorMessageId: latestMessage?.id,
          message: compose.trim(),
        }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; reply?: OwnerReply };
      if (!res.ok) {
        setSendError(data.error ?? 'Failed to send reply.');
        return;
      }
      if (data.reply) {
        setSentReplies(prev => [...prev, data.reply!]);
      }
      setCompose('');
    } catch {
      setSendError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (threads.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <div style={{ fontSize: 48 }}>💬</div>
        <p style={{ marginTop: 16, fontWeight: 600, fontSize: 16, color: 'var(--t2)' }}>No messages yet</p>
        <p style={{ fontSize: 14, marginTop: 8, maxWidth: 420 }}>
          When donors leave messages with their donations, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="kf-messages">
      {/* ── Left: conversation list ── */}
      <section className="kf-card kf-inbox">
        <div className="kf-tabs">
          <button
            className={activeTab === 'inbox' ? 'active' : ''}
            onClick={() => setActiveTab('inbox')}
          >
            Inbox ({threads.length})
          </button>
          <button
            className={activeTab === 'unread' ? 'active' : ''}
            onClick={() => setActiveTab('unread')}
          >
            Unread
          </button>
          <button
            className={activeTab === 'archived' ? 'active' : ''}
            onClick={() => setActiveTab('archived')}
          >
            Archived
          </button>
        </div>
        <label className="kf-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        {filtered.length === 0 ? (
          <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--t3)' }}>No conversations match your search.</p>
        ) : (
          filtered.map((thread) => {
            const latest = thread.messages[0];
            return (
              <article
                key={thread.donorId}
                className={thread.donorId === activeThread?.donorId ? 'active' : ''}
                style={{ cursor: 'pointer' }}
                onClick={() => selectThread(thread.donorId)}
              >
                <Avatar name={thread.donorName} idx={threads.findIndex(t => t.donorId === thread.donorId)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{thread.donorName}</strong>
                  {latest && (
                    <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, fontSize: 13, color: 'var(--t3)' }}>
                      {latest.message}
                    </p>
                  )}
                </div>
                {latest && (
                  <span style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                    {fmtDate(latest.created_at)}
                  </span>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* ── Middle: thread ── */}
      <section className="kf-card kf-thread">
        {activeThread ? (
          <>
            <div className="kf-thread-head">
              <Avatar name={activeThread.donorName} idx={threads.findIndex(t => t.donorId === activeThread.donorId)} />
              <div>
                <h2>{activeThread.donorName} <span>Donor</span></h2>
                <p>
                  {activeThread.campaignIds.length === 1
                    ? (campaignMap[activeThread.campaignIds[0]] ?? 'Campaign')
                    : `${activeThread.campaignIds.length} campaigns`}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activeThread.messages.map(msg => (
                <div key={msg.id} className="kf-bubble left">
                  <Avatar name={activeThread.donorName} idx={0} />
                  <p>
                    {msg.message}
                    <small>{fmtDate(msg.created_at)}</small>
                  </p>
                </div>
              ))}

              {/* Owner's sent replies for this thread (from DB + new sends) */}
              {[...(replies[activeThread.messages[0]?.id ?? ''] ?? []), ...sentReplies].map(r => (
                <div key={r.id} className="kf-bubble right">
                  <p>
                    {r.message}
                    <small>{fmtDate(r.created_at)}</small>
                  </p>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6c35ff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    Me
                  </div>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            {/* Composer */}
            {sendError && (
              <div style={{ padding: '6px 20px', fontSize: 12, color: '#c0003c', fontWeight: 600 }}>
                {sendError}
              </div>
            )}
            <div className="kf-composer">
              <textarea
                placeholder="Type your reply..."
                value={compose}
                onChange={e => setCompose(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <button disabled={sending || !compose.trim()} onClick={() => void handleSend()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/></svg>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--t3)', fontSize: 14 }}>
            Select a conversation
          </div>
        )}
      </section>

      {/* ── Right: donor info ── */}
      <aside className="kf-side-panels">
        <section className="kf-card">
          <h2 style={{ fontSize: 15, fontWeight: 700, padding: '16px 20px 8px' }}>Donor Info</h2>
          {activeThread ? (
            <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={activeThread.donorName} idx={threads.findIndex(t => t.donorId === activeThread.donorId)} />
                <div>
                  <strong style={{ fontSize: 14 }}>{activeThread.donorName}</strong>
                  <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>Supporter</p>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--t2)', borderTop: '1px solid var(--b1)', paddingTop: 12 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--t1)' }}>Campaigns</p>
                {activeThread.campaignIds.map(cid => (
                  <p key={cid} style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {campaignMap[cid] ?? cid}
                  </p>
                ))}
              </div>
              <div style={{ fontSize: 13, borderTop: '1px solid var(--b1)', paddingTop: 12 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--t1)' }}>Messages</p>
                <p style={{ color: 'var(--t3)', margin: 0 }}>{activeThread.messages.length}</p>
              </div>
            </div>
          ) : (
            <p style={{ padding: '0 20px 16px', fontSize: 13, color: 'var(--t3)' }}>
              Select a conversation to view donor details.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
