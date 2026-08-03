'use client';

import { useState } from 'react';
import { Btn } from '../../../../components/ui';
import {
  auctionSummary,
  formatCents,
  isAuctionOpen,
  minimumNextBidCents,
  parseBidToCents,
  validateBid,
  type AuctionItem,
} from '../../../../lib/auctions-core';

// The bidding surface. Every rule shown here comes from auctions-core, the same
// module the API validates with, so the form cannot accept a bid the server will
// reject — and cannot reject one the server would have taken.

export default function AuctionLots({
  items,
  bidCounts,
  signedIn,
}: {
  items: AuctionItem[];
  /** Missing key = unknown, which renders as "bid count unavailable", not "0 bids". */
  bidCounts: Record<string, number> | null;
  signedIn: boolean;
}) {
  const [lots, setLots] = useState(items);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placed, setPlaced] = useState<Record<string, string>>({});

  async function submit(item: AuctionItem) {
    const raw = amounts[item.id] ?? '';
    const cents = parseBidToCents(raw);
    const check = validateBid(item, cents ?? undefined);
    if (!check.ok) {
      setErrors((e) => ({ ...e, [item.id]: check.message }));
      return;
    }
    setBusyId(item.id);
    setErrors((e) => ({ ...e, [item.id]: '' }));
    setPlaced((p) => ({ ...p, [item.id]: '' }));
    try {
      const res = await fetch(`/api/auctions/${item.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: check.amountCents }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; currentBidCents?: number };
      if (!res.ok || !body.ok) {
        setErrors((e) => ({ ...e, [item.id]: body.error ?? 'Your bid could not be placed.' }));
        return;
      }
      setLots((prev) =>
        prev.map((l) => (l.id === item.id ? { ...l, current_bid_cents: body.currentBidCents ?? check.amountCents } : l)),
      );
      setAmounts((a) => ({ ...a, [item.id]: '' }));
      setPlaced((p) => ({ ...p, [item.id]: `You are the high bidder at ${formatCents(check.amountCents)}.` }));
    } catch {
      setErrors((e) => ({ ...e, [item.id]: 'Your bid could not be placed. Check your connection and try again.' }));
    } finally {
      setBusyId(null);
    }
  }

  if (lots.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      {lots.map((item) => {
        const open = isAuctionOpen(item);
        const minimum = minimumNextBidCents(item);
        const count = bidCounts === null ? null : (bidCounts[item.id] ?? 0);
        const error = errors[item.id];
        const success = placed[item.id];
        return (
          <article
            key={item.id}
            style={{
              border: '1px solid var(--b1)',
              borderRadius: 'var(--rl, 14px)',
              background: 'var(--s1)',
              padding: 16,
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15, flex: '1 1 auto', minWidth: 0 }}>{item.title}</strong>
              {!open && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>Closed</span>
              )}
            </div>
            {item.description && (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.5 }}>{item.description}</p>
            )}
            <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 600 }}>
              {auctionSummary(item, count)}
            </div>

            {open && signedIn && (
              <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 4 }}>
                <label htmlFor={`bid-${item.id}`} className="sr-only">
                  Your bid for {item.title}, in dollars
                </label>
                <input
                  id={`bid-${item.id}`}
                  inputMode="decimal"
                  placeholder={formatCents(minimum)}
                  value={amounts[item.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [item.id]: e.target.value }))}
                  aria-describedby={`bid-help-${item.id}`}
                  aria-invalid={Boolean(error)}
                  style={{
                    width: 130, padding: '9px 12px', borderRadius: 10,
                    border: '1px solid var(--b2)', background: 'var(--bg)', color: 'var(--t1)',
                  }}
                />
                <Btn size="sm" loading={busyId === item.id} onClick={() => submit(item)}>
                  {busyId === item.id ? 'Placing…' : 'Place bid'}
                </Btn>
                <span id={`bid-help-${item.id}`} style={{ fontSize: 12, color: 'var(--t3)', alignSelf: 'center' }}>
                  Minimum {formatCents(minimum)}
                </span>
              </div>
            )}

            {open && !signedIn && (
              <a href="/login?next=/events" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text, #15803d)' }}>
                Sign in to bid
              </a>
            )}

            {error && (
              <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red, #b91c1c)' }}>{error}</p>
            )}
            {success && (
              <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--green-text, #15803d)' }}>{success}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
