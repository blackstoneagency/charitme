'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

export type Announcement = {
  id: string; title: string; body: string | null; level: 'info' | 'success' | 'warning' | 'critical';
  link_url: string | null; link_label: string | null;
};

// Banner text is white, so every stop must clear WCAG AA (4.5:1) against white —
// the previous light ends did not (e.g. #f59e0b was ~2.1:1, #19b86a ~2.5:1),
// which would fail accessibility sitewide whenever level colours are enabled.
const BG: Record<string, string> = {
  info: 'linear-gradient(90deg,#1d4ed8,#2563eb)',
  success: 'linear-gradient(90deg,#065f46,#08763b)',
  warning: 'linear-gradient(90deg,#92400e,#b45309)',
  critical: 'linear-gradient(90deg,#991b1b,#b91c1c)',
};
const DISMISS_KEY = 'cm_dismissed_announcements';

// Dismissals live in localStorage (client-only). Read them via useSyncExternalStore
// so the server snapshot is empty ([]) — matching the SSR'd banner — and the client
// reconciles to the real dismissed set after hydration with no mismatch warning and
// no setState-in-effect. A module-level listener set lets a same-tab dismiss notify.
const listeners = new Set<() => void>();
function subscribeDismissed(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === DISMISS_KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
function readDismissedRaw(): string {
  try { return localStorage.getItem(DISMISS_KEY) || '[]'; } catch { return '[]'; }
}
function writeDismissed(ids: string[]): void {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

// Site-wide banner driven by the super-admin Announcements console. Shows the most
// recent active announcement the user hasn't dismissed.
/** Appearance controlled by super admins (see lib/banner-settings.ts). */
export type BannerAppearance = {
  enabled: boolean;
  contentTitle: string;
  contentBody: string;
  contentLinkLabel: string;
  contentLinkUrl: string;
  contentRevision: number;
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  fontFamily: string;
  fontSizePx: number;
  titleFontSizePx: number;
  fontWeight: number;
  titleFontWeight: number;
  textAlign: 'left' | 'center' | 'right';
  letterSpacingEm: number;
  uppercase: boolean;
  paddingYPx: number;
  dismissible: boolean;
  useLevelColors: boolean;
};

export default function AnnouncementBanner({ initial, appearance }: { initial?: Announcement[]; appearance?: BannerAppearance }) {
  // Seeded from the server (SSR) so the bar is in the initial HTML and never
  // injects post-hydration — eliminating the layout shift it used to cause.
  const [items, setItems] = useState<Announcement[]>(initial ?? []);
  const seenRaw = useSyncExternalStore(subscribeDismissed, readDismissedRaw, () => '[]');
  const seen = useMemo<string[]>(() => { try { return JSON.parse(seenRaw); } catch { return []; } }, [seenRaw]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/announcements')
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((d: { announcements?: Announcement[] }) => { if (!cancelled) setItems(d.announcements ?? []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  const current = useMemo(() => {
    if (appearance && appearance.contentTitle.trim()) {
      const custom: Announcement = {
        id: `global-banner-${appearance.contentRevision}`,
        title: appearance.contentTitle.trim(),
        body: appearance.contentBody || null,
        level: 'info',
        link_url: appearance.contentLinkUrl || null,
        link_label: appearance.contentLinkLabel || null,
      };
      return seen.includes(custom.id) ? null : custom;
    }
    return items.find((announcement) => !seen.includes(announcement.id)) ?? null;
  }, [appearance, items, seen]);

  // Global kill switch — super admins can hide the banner site-wide regardless
  // of how many announcements are active.
  if (appearance && !appearance.enabled) return null;
  if (!current) return null;

  const a = appearance;
  // Values are validated server-side on both write and read (lib/banner-settings.ts)
  // before reaching these inline styles.
  const background = a && !a.useLevelColors ? a.backgroundColor : (BG[current.level] ?? BG.info);
  const fg         = a ? a.textColor : '#fff';
  const linkFg     = a ? a.linkColor : '#fff';

  const dismiss = () => {
    writeDismissed([...seen, current.id]);
  };

  return (
    <div role="status" style={{ background, color: fg }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: `${a ? a.paddingYPx : 9}px 16px`,
        display: 'flex', minWidth: 0, alignItems: 'center', gap: 12,
        justifyContent: a?.textAlign === 'center' ? 'center' : a?.textAlign === 'right' ? 'flex-end' : 'flex-start',
        fontSize: a ? a.fontSizePx : 14,
        fontFamily: a ? a.fontFamily : 'inherit',
        fontWeight: a ? a.fontWeight : 400,
        letterSpacing: a && a.letterSpacingEm ? `${a.letterSpacingEm}em` : undefined,
        textTransform: a?.uppercase ? 'uppercase' : undefined,
      }}>
        <strong style={{ fontWeight: a ? a.titleFontWeight : 700, fontSize: a ? a.titleFontSizePx : undefined }}>{current.title}</strong>
        {current.body && <span style={{ opacity: 0.92, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.body}</span>}
        {current.link_url && (
          <a href={current.link_url} style={{ color: linkFg, fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
            {current.link_label || 'Learn more'} →
          </a>
        )}
        {(!a || a.dismissible) && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss announcement"
            // min 28px hit area: the glyph alone was a 15x18 tap target on mobile,
            // below the 24px minimum (WCAG 2.5.8) — and this banner is sitewide.
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: fg, cursor: 'pointer', fontSize: 18, lineHeight: 1, opacity: 0.85, flexShrink: 0, minWidth: 28, minHeight: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: 6 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
