'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Announcement = {
  id: string; title: string; body: string | null; level: 'info' | 'success' | 'warning' | 'critical';
  link_url: string | null; link_label: string | null;
};

const BG: Record<string, string> = {
  info: 'linear-gradient(90deg,#2f6fed,#5b8def)',
  success: 'linear-gradient(90deg,#0f9d58,#19b86a)',
  warning: 'linear-gradient(90deg,#d97706,#f59e0b)',
  critical: 'linear-gradient(90deg,#c81e1e,#e5342f)',
};
const DISMISS_KEY = 'cm_dismissed_announcements';

function dismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch { return []; }
}

// Site-wide banner driven by the super-admin Announcements console. Shows the most
// recent active announcement the user hasn't dismissed.
export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  // Lazy initializer reads localStorage once; dismissed() is SSR-safe (try/catch).
  const [seen, setSeen] = useState<string[]>(dismissed);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/announcements')
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((d: { announcements?: Announcement[] }) => { if (!cancelled) setItems(d.announcements ?? []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  const current = useMemo(() => items.find((a) => !seen.includes(a.id)) ?? null, [items, seen]);

  if (!current) return null;

  const dismiss = () => {
    const next = [...seen, current.id];
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setSeen(next);
  };

  return (
    <div role="status" style={{ background: BG[current.level] ?? BG.info, color: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
        <strong style={{ fontWeight: 700 }}>{current.title}</strong>
        {current.body && <span style={{ opacity: 0.92, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.body}</span>}
        {current.link_url && (
          <a href={current.link_url} style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
            {current.link_label || 'Learn more'} →
          </a>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, opacity: 0.85, flexShrink: 0 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
