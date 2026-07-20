'use client';

import React, { useState } from 'react';

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openPortal = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not open billing portal.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flexShrink: 0 }}>
      {error ? <p style={{ fontSize: 11, color: 'var(--red-text)', marginBottom: 4 }}>{error}</p> : null}
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        style={{
          fontSize: 13,
          fontWeight: 700,
          border: '1px solid var(--b2)',
          background: '#fff',
          color: 'var(--t1)',
          borderRadius: 'var(--r)',
          padding: '10px 20px',
          cursor: 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Opening…' : 'Manage Billing'}
      </button>
    </div>
  );
}
