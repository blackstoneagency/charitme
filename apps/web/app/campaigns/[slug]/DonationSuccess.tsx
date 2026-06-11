'use client';

import React, { useState, useEffect } from 'react';

export default function DonationSuccess() {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 12000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #19b86a, #0f9454)',
        color: '#fff',
        borderRadius: 14,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 8px 32px rgba(25, 184, 106, .35)',
        maxWidth: 480,
        width: 'calc(100% - 48px)',
        animation: 'slideUp .3s ease',
      }}
    >
      <span style={{ fontSize: 24 }}>💚</span>
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', fontSize: 15, fontWeight: 900 }}>
          Thank you for donating!
        </strong>
        <span style={{ fontSize: 13, opacity: 0.9 }}>
          Your receipt has been emailed to you.
        </span>
        <a
          href="#quick-share"
          onClick={() => setVisible(false)}
          style={{
            display: 'inline-block', marginTop: 6, fontSize: 13, fontWeight: 800,
            color: '#fff', textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >
          Double your impact — share with friends →
        </a>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        style={{
          background: 'rgba(255,255,255,.2)',
          border: 0,
          color: '#fff',
          width: 28,
          height: 28,
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: 16,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
