'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV_GROUPS, PRIMARY_NAV_DIRECT } from '../lib/primary-nav';
import { useT } from './LocaleProvider';

/**
 * Header navigation with grouped dropdowns.
 *
 * Built on <button aria-expanded> + a real list, not hover-only CSS: a hover menu
 * is unreachable by keyboard and unusable on touch, where the first tap opens it
 * and the same tap follows the link underneath.
 *
 * Opens on CLICK, deliberately, with no hover-to-open. Hover handlers would have
 * to sit on the wrapping element rather than the button — the pointer must be able
 * to travel from trigger to panel without closing it — and that element is not
 * interactive, which jsx-a11y flags for good reason. Click also means the menu
 * behaves identically on touch and on desktop, instead of being a different
 * control depending on the input device.
 */
export default function PrimaryNavMenu() {
  const t = useT();
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  // Close on outside click and on Escape. Without the Escape handler a keyboard
  // user who opens a menu has no way to dismiss it without tabbing through every
  // item in it.
  useEffect(() => {
    if (openGroup === null) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  // Navigating closes the menu — otherwise the panel stays open over the page the
  // visitor just asked for.
  //
  // Adjusted during render on a CHANGED value, which is React's documented pattern
  // for this and what SuperAdminNav already does here. An effect would work but
  // costs a second render pass, and the lint rule rejects it for that reason.
  // Keyed on the transition rather than the value, so it does not fight a visitor
  // who reopens a menu without navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (openGroup !== null) setOpenGroup(null);
  }

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div ref={containerRef} className="kf-primary-nav" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {PRIMARY_NAV_GROUPS.map((group) => {
        const open = openGroup === group.label;
        const panelId = `${baseId}-${group.label}`;
        const groupActive = group.links.some((l) => isCurrent(l.href));
        return (
          <div key={group.label} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-haspopup="true"
              onClick={() => setOpenGroup(open ? null : group.label)}
              className={`kf-nav-group-trigger${groupActive ? ' active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                // 40px keeps this a comfortable target and matches the header row
                // height; WCAG 2.2 SC 2.5.8 needs 24 as an absolute floor.
                minHeight: 40,
                padding: '0 12px',
                border: 'none',
                background: 'none',
                color: groupActive ? 'var(--brand-text)' : 'var(--t2)',
                font: 'inherit',
                fontSize: 14.5,
                fontWeight: groupActive ? 700 : 600,
                cursor: 'pointer',
                borderRadius: 'var(--r)',
              }}
            >
              {t(group.labelKey)}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
                style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {open && (
              <div
                id={panelId}
                role="group"
                aria-label={t(group.labelKey)}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  minWidth: 264,
                  padding: 14,
                  borderRadius: 'var(--rl)',
                  // Themed tokens, never a hardcoded #fff: a literal white panel
                  // survives into dark mode and drags every child's contrast with it.
                  background: 'var(--s1)',
                  border: '1px solid var(--b1)',
                  boxShadow: 'var(--shadow-md, 0 18px 50px rgba(20,16,60,.16))',
                  zIndex: 60,
                }}
              >
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--t3)', lineHeight: 1.4 }}>
                  {t(group.blurbKey)}
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={isCurrent(link.href) ? 'page' : undefined}
                        style={{
                          display: 'block',
                          padding: '9px 10px',
                          borderRadius: 'var(--r)',
                          fontSize: 14,
                          color: isCurrent(link.href) ? 'var(--brand-text)' : 'var(--t1)',
                          fontWeight: isCurrent(link.href) ? 700 : 500,
                          textDecoration: 'none',
                        }}
                      >
                        {t(link.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}

      {PRIMARY_NAV_DIRECT.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isCurrent(link.href) ? 'page' : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 40,
            padding: '0 12px',
            borderRadius: 'var(--r)',
            fontSize: 14.5,
            fontWeight: isCurrent(link.href) ? 700 : 600,
            color: isCurrent(link.href) ? 'var(--brand-text)' : 'var(--t2)',
            textDecoration: 'none',
          }}
        >
          {t(link.labelKey)}
        </Link>
      ))}
    </div>
  );
}
