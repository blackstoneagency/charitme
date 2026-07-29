'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SUPER_ADMIN_NAV } from '../lib/super-admin-nav';

// The list itself lives in lib/super-admin-nav.ts, a module with NO 'use client'
// directive: app/admin/super/page.tsx is a Server Component, and plain data does not
// survive the client boundary. Re-exported here for existing importers.
export { SUPER_ADMIN_NAV } from '../lib/super-admin-nav';

function Icon({ name }: { name: string }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shapes: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    crown: <path d="M3 8l4 3 5-7 5 7 4-3-2 10H5L3 8Z" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7Z" /></>,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.3.36.5.74.6 1.1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    spark: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" /></>,
    chevron: <path d="M9 18l6-6-6-6" />,
  };
  return <svg {...p} className="kf-icon">{shapes[name] ?? shapes.grid}</svg>;
}

export default function SuperAdminNav() {
  const path = usePathname();
  // Membership is derived from the nav list itself, not from a `/admin/super/`
  // prefix — entries like AI (/admin/ai) and Marketing (/admin/marketing) live
  // outside that path and would otherwise leave the section collapsed while the
  // user is standing on one of its pages.
  const onSuper = SUPER_ADMIN_NAV.some(([, href]) => path === href || path.startsWith(href + '/'));
  const [isSuper, setIsSuper] = useState<boolean | null>(null);
  const [open, setOpen] = useState(onSuper);

  // Client-side navigation INTO the section expands it. Adjusting state during
  // render on a changed value is React's documented pattern for this and avoids
  // the cascading extra render an effect would cause. Keyed on the transition,
  // not the value, so it does not fight a user who collapses it while inside.
  const [wasOnSuper, setWasOnSuper] = useState(onSuper);
  if (onSuper !== wasOnSuper) {
    setWasOnSuper(onSuper);
    if (onSuper) setOpen(true);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/super/whoami')
      .then((r) => (r.ok ? r.json() : { superAdmin: false }))
      .then((d: { superAdmin?: boolean }) => { if (!cancelled) setIsSuper(Boolean(d.superAdmin)); })
      .catch(() => { if (!cancelled) setIsSuper(false); });
    return () => { cancelled = true; };
  }, []);

  if (!isSuper) return null;

  return (
    <div className="kf-super-nav">
      <div className="kf-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: 999, background: 'linear-gradient(135deg,#7c3aed,#ff8a1e)' }} />
        Super Admin
      </div>
      <button
        type="button"
        className={`kf-super-toggle${onSuper ? ' active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="crown" />
        <span>Admin</span>
        <span className={`kf-super-caret${open ? ' open' : ''}`} style={{ marginLeft: 'auto', display: 'inline-flex' }}><Icon name="chevron" /></span>
      </button>
      {open && (
        <nav className="kf-nav kf-super-sublist">
          {SUPER_ADMIN_NAV.map(([label, href, icon]) => {
            const isActive = path === href || (href !== '/admin/super' && path.startsWith(href + '/'));
            return (
              <Link key={href} href={href} className={isActive ? 'active' : ''}>
                <Icon name={icon} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
