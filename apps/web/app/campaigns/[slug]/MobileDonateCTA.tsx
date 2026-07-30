'use client';

import React, { useEffect, useState } from 'react';
import { currencySymbol, DEFAULT_CURRENCY } from '@shared/currencies';

interface Props {
  campaignTitle: string;
  raised: number;
  goal: number;
  pct: number;
  isActive: boolean;
  campaignId: string;
  currency?: string;
}

function fmtCents(c: number, symbol: string) {
  const d = c / 100;
  if (d >= 1_000_000) return `${symbol}${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `${symbol}${Math.round(d).toLocaleString()}`;
  return `${symbol}${d.toFixed(2)}`;
}

// Shown only on mobile (≤ 768px) and only after scrolling past the main donate section
export default function MobileDonateCTA({ campaignTitle, raised, pct, isActive, currency = DEFAULT_CURRENCY }: Props) {
  const symbol = currencySymbol(currency);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after scrolling past 300px (past the donate sidebar)
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!isActive) return null;

  return (
    <div
      role="complementary"
      aria-label="Donate to this campaign"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        background: 'var(--s1, #fff)',
        borderTop: '1px solid var(--b1, #e2e8f0)',
        padding: '12px 16px 16px',
        boxShadow: '0 -4px 20px rgba(0,0,0,.10)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'transform .25s ease',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        // Only show on mobile
      }}
      className="mobile-donate-bar"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campaignTitle}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 5, background: 'var(--b1, #e2e8f0)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#6c35ff,#ec3fb4)', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet, #6c35ff)', flexShrink: 0 }}>
            {fmtCents(raised, symbol)} raised
          </span>
        </div>
      </div>
      <a
        href={`#donate-section`}
        onClick={(e) => {
          e.preventDefault();
          document.querySelector('.pc-donate')?.scrollIntoView({ behavior: 'smooth' });
        }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          height: 44, padding: '0 20px', borderRadius: 10, border: 0,
          background: 'linear-gradient(135deg,#6c35ff,#4d1ee0)',
          color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
          flexShrink: 0, boxShadow: '0 4px 12px rgba(108,53,255,.35)',
        }}
        aria-label={`Donate to ${campaignTitle}`}
      >
        Donate →
      </a>
    </div>
  );
}
