'use client';

import { useCallback, useEffect, useState } from 'react';

// ═════════════════════════════════════════════════════════════════════════════
// Stripe Connect sample — platform dashboard
//   • Create a connected account
//   • See each account's live onboarding + payout status
//   • Send a user to hosted onboarding
//   • Create products (sold via the storefront)
// This is a self-contained demo of the V2 Connect flow. It talks only to the
// /api/connect-sample/* routes, which use the shared Stripe Client.
// ═════════════════════════════════════════════════════════════════════════════

type Account = { id: string; display_name: string | null; contact_email: string | null; transfers_active: boolean };
type Status = { readyToReceivePayments: boolean; onboardingComplete: boolean; requirementsStatus: string | null };
type Product = { id: string; name: string; unit_amount: number | null; currency: string; connected_account_id: string | null };

const card: React.CSSProperties = {
  background: 'var(--s1, #fff)',
  border: '1px solid var(--b1, #e5e7eb)',
  borderRadius: 'var(--rl, 12px)',
  padding: 20,
  marginBottom: 20,
};
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--t2, #374151)' };
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--r, 8px)',
  border: '1px solid var(--b2, #d1d5db)', marginBottom: 12, fontSize: 14,
};
const btn: React.CSSProperties = {
  background: 'var(--green, #16a34a)', color: '#fff', border: 'none',
  borderRadius: 'var(--r, 8px)', padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 14,
};
const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--green, #16a34a)', border: '1px solid var(--green, #16a34a)' };

function money(cents: number | null, currency = 'usd') {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export default function ConnectSampleDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create-account form
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Create-product form
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pAccount, setPAccount] = useState('');

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/connect-sample/accounts');
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Failed to load accounts'); return; }
    setAccounts(json.data || []);
    setError(null);
  }, []);

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/connect-sample/products');
    const json = await res.json();
    if (res.ok) setProducts(json.data || []);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void loadAccounts(); void loadProducts(); }, [loadAccounts, loadProducts]);

  const refreshStatus = useCallback(async (id: string) => {
    const res = await fetch(`/api/connect-sample/accounts/${id}/status`);
    const json = await res.json();
    if (res.ok) setStatuses((s) => ({ ...s, [id]: json }));
  }, []);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/connect-sample/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, contactEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create account');
      setDisplayName(''); setContactEmail('');
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally { setBusy(false); }
  }

  async function onboard(id: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/connect-sample/accounts/${id}/onboard`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start onboarding');
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding');
      setBusy(false);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/connect-sample/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pName, description: pDesc,
          priceCents: Math.round(parseFloat(pPrice) * 100), accountId: pAccount,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create product');
      setPName(''); setPDesc(''); setPPrice(''); setPAccount('');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font, system-ui, sans-serif)' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Stripe Connect — sample dashboard</h1>
      <p style={{ color: 'var(--t3, #6b7280)', marginBottom: 24, fontSize: 14 }}>
        Create connected accounts, onboard them, and list products.{' '}
        <a href="/connect-sample/storefront" style={{ color: 'var(--green, #16a34a)', fontWeight: 600 }}>Open storefront →</a>
      </p>

      {error && (
        <div style={{ ...card, borderColor: 'var(--red, #dc2626)', color: 'var(--red, #dc2626)', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      <section style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1. Create a connected account</h2>
        <form onSubmit={createAccount}>
          <label style={label}>Display name</label>
          <input style={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane's Bakery" required />
          <label style={label}>Contact email</label>
          <input style={input} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@example.com" required />
          <button style={btn} disabled={busy} type="submit">Create account</button>
        </form>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2. Connected accounts</h2>
        {accounts.length === 0 && <p style={{ color: 'var(--t3, #6b7280)', fontSize: 14 }}>No accounts yet.</p>}
        {accounts.map((a) => {
          const st = statuses[a.id];
          return (
            <div key={a.id} style={{ borderTop: '1px solid var(--b1, #e5e7eb)', padding: '12px 0' }}>
              <div style={{ fontWeight: 600 }}>{a.display_name || '(no name)'}</div>
              <div style={{ fontSize: 13, color: 'var(--t3, #6b7280)' }}>{a.contact_email} · <code>{a.id}</code></div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Payouts: <strong style={{ color: a.transfers_active ? 'var(--green, #16a34a)' : 'var(--t3, #6b7280)' }}>
                  {a.transfers_active ? 'active' : 'not active'}
                </strong>
                {st && (
                  <> · Onboarding: <strong>{st.onboardingComplete ? 'complete' : 'incomplete'}</strong>
                    {st.requirementsStatus ? ` (${st.requirementsStatus})` : ''}</>
                )}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={btn} disabled={busy} onClick={() => onboard(a.id)}>Onboard to collect payments</button>
                <button style={btnGhost} disabled={busy} onClick={() => refreshStatus(a.id)}>Refresh status</button>
              </div>
            </div>
          );
        })}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>3. Create a product</h2>
        <form onSubmit={createProduct}>
          <label style={label}>Product name</label>
          <input style={input} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Sourdough loaf" required />
          <label style={label}>Description (optional)</label>
          <input style={input} value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Freshly baked" />
          <label style={label}>Price (USD)</label>
          <input style={input} type="number" min="0.50" step="0.01" value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder="9.99" required />
          <label style={label}>Connected account</label>
          <select style={input} value={pAccount} onChange={(e) => setPAccount(e.target.value)} required>
            <option value="">Select an account…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name || a.id}</option>)}
          </select>
          <button style={btn} disabled={busy || accounts.length === 0} type="submit">Create product</button>
        </form>
        {products.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--t2, #374151)' }}>Existing products</div>
            {products.map((p) => (
              <div key={p.id} style={{ fontSize: 13, padding: '4px 0', color: 'var(--t2, #374151)' }}>
                {p.name} — {money(p.unit_amount, p.currency)} <span style={{ color: 'var(--t4, #9ca3af)' }}>({p.connected_account_id})</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
