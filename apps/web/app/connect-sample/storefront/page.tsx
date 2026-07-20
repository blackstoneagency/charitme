'use client';

import { useEffect, useState } from 'react';

// ═════════════════════════════════════════════════════════════════════════════
// Stripe Connect sample — storefront
// Lists every sample product across all connected accounts and lets a customer
// buy one. Checkout is a destination charge: the platform takes an application
// fee and the rest settles to the product's connected account.
// ═════════════════════════════════════════════════════════════════════════════

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_id: string | null;
  unit_amount: number | null;
  currency: string;
  connected_account_id: string | null;
};

function money(cents: number | null, currency = 'usd') {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

const card: React.CSSProperties = {
  background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e5e7eb)',
  borderRadius: 'var(--rl, 12px)', padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
};
const btn: React.CSSProperties = {
  background: 'var(--green, #16a34a)', color: '#fff', border: 'none',
  borderRadius: 'var(--r, 8px)', padding: '10px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 14, marginTop: 'auto',
};

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/connect-sample/products');
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to load products'); return; }
      setProducts(json.data || []);
    })();
  }, []);

  async function buy(priceId: string | null) {
    if (!priceId) return;
    setBuying(priceId); setError(null);
    try {
      const res = await fetch('/api/connect-sample/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, quantity: 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setBuying(null);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font, system-ui, sans-serif)' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Storefront</h1>
      <p style={{ color: 'var(--t3, #6b7280)', marginBottom: 24, fontSize: 14 }}>
        Products from all connected accounts.{' '}
        <a href="/connect-sample" style={{ color: 'var(--green, #16a34a)', fontWeight: 600 }}>← Back to dashboard</a>
      </p>

      {error && (
        <div style={{ ...card, borderColor: 'var(--red, #dc2626)', color: 'var(--red, #dc2626)', background: '#fef2f2', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {products.length === 0 && !error && (
        <p style={{ color: 'var(--t3, #6b7280)' }}>No products yet — create one on the dashboard.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {products.map((p) => (
          <div key={p.id} style={card}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
            {p.description && <div style={{ fontSize: 13, color: 'var(--t3, #6b7280)' }}>{p.description}</div>}
            <div style={{ fontSize: 20, fontWeight: 800 }}>{money(p.unit_amount, p.currency)}</div>
            <button style={btn} disabled={buying === p.price_id || !p.price_id} onClick={() => buy(p.price_id)}>
              {buying === p.price_id ? 'Redirecting…' : 'Buy'}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
