'use client';

import { useEffect, useState } from 'react';

type NavItem = { label: string; href: string };

/**
 * "Customize your left navigation" — one person's own sidebar.
 *
 * Reads and writes `/api/me/navigation`, which resolves identity from the
 * session. Nothing here sends a user id, and nothing here can add a link: the
 * list of items comes from the server-rendered persona navigation, so this
 * screen can only reorder or hide what the role already grants.
 */
export default function NavigationPreferences({ items }: { items: NavItem[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/navigation')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { hidden?: string[]; order?: string[] } | null) => {
        if (cancelled || !data) { if (!cancelled) setStatus('idle'); return; }
        setHidden(Array.isArray(data.hidden) ? data.hidden : []);
        setOrder(Array.isArray(data.order) ? data.order : []);
        setStatus('idle');
      })
      .catch(() => { if (!cancelled) setStatus('idle'); });
    return () => { cancelled = true; };
  }, []);

  // The rendered order: explicitly ordered items first, then the rest in their
  // persona order — the same rule the server composer applies, so this preview
  // matches what the sidebar will actually do.
  const rank = new Map(order.map((href, i) => [href, i]));
  const sorted = [...items].sort((a, b) => {
    const ra = rank.has(a.href) ? rank.get(a.href)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.href) ? rank.get(b.href)! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return items.indexOf(a) - items.indexOf(b);
  });

  const visibleCount = items.length - hidden.length;

  function toggle(href: string) {
    setHidden((prev) => {
      if (prev.includes(href)) return prev.filter((h) => h !== href);
      // Refuse the last one here too, so the control explains itself rather than
      // letting the server reject the save afterwards.
      if (items.length - prev.length <= 1) {
        setMessage('At least one item must stay visible.');
        return prev;
      }
      setMessage('');
      return [...prev, href];
    });
  }

  function move(href: string, delta: -1 | 1) {
    const current = sorted.map((i) => i.href);
    const from = current.indexOf(href);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= current.length) return;
    const next = [...current];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  }

  async function save() {
    setStatus('saving');
    setMessage('');
    try {
      const res = await fetch('/api/me/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden, order: order.length > 0 ? order : sorted.map((i) => i.href) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus('error');
        setMessage((data as { error?: string } | null)?.error ?? 'Could not save.');
        return;
      }
      setStatus('saved');
      setMessage('Saved. Reload to see your sidebar update.');
    } catch {
      setStatus('error');
      setMessage('Could not save.');
    }
  }

  async function reset() {
    setHidden([]);
    setOrder([]);
    setStatus('saving');
    try {
      await fetch('/api/me/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: [], order: [] }),
      });
      setStatus('saved');
      setMessage('Reset to the default navigation.');
    } catch {
      setStatus('error');
      setMessage('Could not reset.');
    }
  }

  return (
    <section style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: '20px 24px', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>
        Your left navigation
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--t3)' }}>
        Hide items you never use, or move the ones you use most to the top. This changes
        only your own sidebar.
      </p>

      {status === 'loading' ? (
        <p style={{ fontSize: 13.5, color: 'var(--t3)' }}>Loading…</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
            {sorted.map((item, index) => {
              const isHidden = hidden.includes(item.href);
              return (
                <li
                  key={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 10,
                    border: '1px solid var(--b1)', background: 'var(--s2)',
                    opacity: isHidden ? 0.55 : 1,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minHeight: 44, cursor: 'pointer', fontSize: 14, color: 'var(--t1)' }}>
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggle(item.href)}
                      style={{ width: 20, height: 20 }}
                    />
                    <span style={{ textDecoration: isHidden ? 'line-through' : 'none' }}>{item.label}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => move(item.href, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${item.label} up`}
                    style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t2)', cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => move(item.href, 1)}
                    disabled={index === sorted.length - 1}
                    aria-label={`Move ${item.label} down`}
                    style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t2)', cursor: index === sorted.length - 1 ? 'not-allowed' : 'pointer' }}
                  >↓</button>
                </li>
              );
            })}
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={save}
              disabled={status === 'saving'}
              style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, border: 0, background: 'var(--violet)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              {status === 'saving' ? 'Saving…' : 'Save navigation'}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--b2)', background: 'transparent', color: 'var(--t2)', fontWeight: 650, fontSize: 14, cursor: 'pointer' }}
            >
              Reset to default
            </button>
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>
              {visibleCount} of {items.length} shown
            </span>
          </div>

          {message && (
            <p
              role="status"
              style={{ margin: '12px 0 0', fontSize: 13.5, color: status === 'error' ? 'var(--red-text)' : 'var(--green-text)' }}
            >
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
