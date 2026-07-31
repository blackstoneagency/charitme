'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Btn, Card, Input, EmptyState } from '../../components/ui';
import { splitEvenly, MAX_PORTFOLIO_CAMPAIGNS, MIN_PORTFOLIO_SHARE_CENTS } from '../../lib/portfolio-split';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';

export interface GiveCampaign {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string;
  cover_image_url: string | null;
  raised_amount: number;
  goal_amount: number;
}

// One amount, several campaigns. The split is shown live and to the cent BEFORE
// checkout, because "we divide it for you" is only trustworthy if the donor can
// see exactly what each campaign receives — including which one gets the spare
// cent when the division is not clean.

export default function GiveClient({ campaigns }: { campaigns: GiveCampaign[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState('60');
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = Math.round(Number.parseFloat(amount || '0') * 100);

  const split = useMemo(
    () => (selected.length > 0 && totalCents > 0 ? splitEvenly(totalCents, selected) : []),
    [selected, totalCents],
  );

  const perCampaignTooSmall =
    split.length > 0 && split.some((p) => p.amountCents < MIN_PORTFOLIO_SHARE_CENTS);

  function toggle(id: string) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PORTFOLIO_CAMPAIGNS) {
        setError(`You can support up to ${MAX_PORTFOLIO_CAMPAIGNS} campaigns in one gift.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function give() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/donations/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          campaignIds: selected,
          totalCents,
          anonymous,
          message: message.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Could not start checkout.');
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const byId = new Map(campaigns.map((c) => [c.id, c]));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>
          1. How much would you like to give?
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--t3)' }}>
          CharitMe takes <strong>0%</strong>. Every cent below reaches the campaigns you choose.
        </p>
        <div style={{ maxWidth: 220 }}>
          <Input
            label="Amount (USD)"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>
          2. Choose the causes
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--t3)' }}>
          Pick up to {MAX_PORTFOLIO_CAMPAIGNS}. Selected: <strong>{selected.length}</strong>
        </p>

        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns available right now"
            body="Nothing is live to fund at the moment. Browse every fundraiser instead."
          />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: 14,
            }}
          >
            {campaigns.map((c) => {
              const on = selected.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: `2px solid ${on ? 'var(--violet-ink)' : 'var(--b1)'}`,
                      background: on ? 'var(--tint-violet)' : 'var(--s1)',
                      borderRadius: 'var(--rl)',
                      padding: 14,
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 14.5, color: 'var(--t1)', lineHeight: 1.35 }}>
                      {c.title}
                    </strong>
                    {c.tagline && (
                      <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, color: 'var(--t3)' }}>
                        {c.tagline}
                      </span>
                    )}
                    <span style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--t4)' }}>
                      {c.category} · {formatMoneyShort(c.raised_amount, DEFAULT_CURRENCY)} raised
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>
          3. Your split
        </h2>
        {split.length === 0 ? (
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--t3)' }}>
            Choose an amount and at least one campaign to see the breakdown.
          </p>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
              {split.map((p) => (
                <li
                  key={p.campaignId}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, color: 'var(--t2)' }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {byId.get(p.campaignId)?.title ?? p.campaignId}
                  </span>
                  <strong style={{ color: 'var(--t1)', whiteSpace: 'nowrap' }}>
                    {formatMoneyShort(p.amountCents, DEFAULT_CURRENCY)}
                  </strong>
                </li>
              ))}
            </ul>
            <div
              style={{
                borderTop: '1px solid var(--b1)',
                marginTop: 12,
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--t1)',
              }}
            >
              <span>Total</span>
              <span>{formatMoneyShort(totalCents, DEFAULT_CURRENCY)}</span>
            </div>
            {/* Stated because an uneven division is otherwise mistaken for a bug.
                The parts always sum to the total exactly — the spare cents go to
                the first campaigns in the list. */}
            {totalCents % split.length !== 0 && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--t4)' }}>
                This amount does not divide evenly, so the spare {totalCents % split.length}
                {totalCents % split.length === 1 ? ' cent goes' : ' cents go'} to the first campaigns
                listed. The parts always add up to exactly your total.
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--t2)' }}>
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Give anonymously
          </label>
          <Input
            label="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Shown to each campaign you support."
            maxLength={500}
          />
          {perCampaignTooSmall && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>
              Each campaign must receive at least ${(MIN_PORTFOLIO_SHARE_CENTS / 100).toFixed(2)}. Raise the
              amount or choose fewer campaigns.
            </p>
          )}
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{error}</p>}
          <div>
            <Btn
              onClick={give}
              loading={loading}
              disabled={selected.length === 0 || totalCents <= 0 || perCampaignTooSmall}
            >
              Give {totalCents > 0 ? formatMoneyShort(totalCents, DEFAULT_CURRENCY) : ''} to {selected.length || 'these'}{' '}
              {selected.length === 1 ? 'campaign' : 'campaigns'}
            </Btn>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--t4)' }}>
            One payment, one receipt.{' '}
            <Link href="/campaigns" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
              Browse all campaigns
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
