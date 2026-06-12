'use client';

import React, { useEffect, useState } from 'react';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';

interface TickerDonation {
  id: string;
  name: string;
  amountCents: number;
  createdAt: string;
  anonymous: boolean;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const POLL_INTERVAL_MS = 20_000;
const ROTATE_INTERVAL_MS = 5_000;

export default function DonationTicker({
  campaignId,
  initialDonations,
  currency = DEFAULT_CURRENCY,
}: {
  campaignId: string;
  initialDonations: TickerDonation[];
  currency?: string;
}) {
  const fmtCents = (c: number) => formatMoneyShort(c, currency);
  const [items, setItems] = useState(initialDonations);
  const [index, setIndex] = useState(0);
  const [, setTick] = useState(0);

  // Poll for newer donations and prepend them to the queue
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const since = items[0]?.createdAt;
      const url = since
        ? `/api/campaigns/${campaignId}/donations?since=${encodeURIComponent(since)}`
        : `/api/campaigns/${campaignId}/donations?limit=1`;
      try {
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data: { donations: TickerDonation[] } = await res.json();
        if (data.donations.length > 0) {
          setItems((prev) => [...data.donations.slice().reverse(), ...prev].slice(0, 10));
          setIndex(0);
        }
      } catch { /* ignore — ticker is best-effort */ }
    };
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [campaignId, items]);

  // Rotate through the queue
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [items.length]);

  // Re-render every 30s so "Xm ago" stays fresh
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;
  const item = items[index % items.length];

  return (
    <div className="pc-ticker" key={item.id} role="status" aria-live="polite">
      <span className="pc-ticker-dot" aria-hidden="true" />
      <span className="pc-ticker-text">
        <b>{item.anonymous ? 'A kind supporter' : item.name}</b> donated <b>{fmtCents(item.amountCents)}</b>
      </span>
      <span className="pc-ticker-time">{timeAgo(item.createdAt)}</span>
    </div>
  );
}
