'use client';

import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// The paid "feature my campaign" offer, shown at the moment a campaign goes live.
//
// The fee is CONFIGURABLE in the admin portal and can change at any moment, so
// the price is fetched rather than written into this file. A hardcoded "$5"
// would silently misquote the creator the first time an admin changed it, and
// the mismatch would only surface at the Stripe page — after they clicked buy.
//
// Renders nothing at all until the price is known, and nothing if the campaign
// is already featured. An upsell that appears with a blank or guessed price is
// worse than one that appears a beat later.
// ─────────────────────────────────────────────────────────────────────────────

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });

export default function FeatureUpsell({ campaignId }: { campaignId: string }) {
  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [featured, setFeatured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/feature`);
        if (!res.ok) return; // stay hidden rather than guess a price
        const json = await res.json();
        if (cancelled) return;
        if (typeof json.priceCents === 'number') setPriceCents(json.priceCents);
        setFeatured(Boolean(json.featured));
      } catch {
        // Silent: this is an optional upsell on a success screen. Failing loudly
        // here would put an error banner on "Your campaign is live!".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Come back to the builder, not the dashboard — this creator is mid-launch
        // and the share panel is on this screen.
        body: JSON.stringify({ returnTo: 'create' }),
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

  if (featured) {
    return (
      <div
        style={{
          margin: '0 auto 22px',
          maxWidth: 460,
          padding: '14px 18px',
          borderRadius: 14,
          background: 'rgba(16,185,129,.10)',
          border: '1px solid rgba(16,185,129,.35)',
          textAlign: 'left',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: 'var(--t1)' }}>
          ⭐ Featured on the homepage
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--t2)', margin: 0 }}>
          Your campaign rotates through the CharitMe homepage spotlight while it is still running and
          short of its goal.
        </p>
      </div>
    );
  }

  if (priceCents === null) return null;

  return (
    <div
      style={{
        margin: '0 auto 22px',
        maxWidth: 460,
        padding: '16px 18px',
        borderRadius: 14,
        background: 'rgba(109,53,255,.08)',
        border: '1px solid rgba(109,53,255,.30)',
        textAlign: 'left',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: 'var(--t1)' }}>
        ⭐ Feature this campaign for {money(priceCents)}
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--t2)', margin: '0 0 10px' }}>
        A one-time fee puts your campaign into the rotating spotlight on the CharitMe homepage. It
        stays in rotation while it is still running and has not yet reached its goal.
      </p>
      {/* Said plainly. This is the one payment on CharitMe that is NOT a donation
          and does not reach a campaign, so it should never be mistaken for one. */}
      <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--t3)', margin: '0 0 12px' }}>
        This is a platform placement fee paid to CharitMe, not a donation to your campaign, and it is
        not refundable once your campaign is in rotation.
      </p>
      {error && (
        <p role="alert" style={{ fontSize: 13, color: 'var(--red-text)', margin: '0 0 10px' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        className="cr2-btn-launch"
        style={{ width: '100%' }}
        onClick={() => void buy()}
        disabled={loading}
      >
        {loading ? 'Redirecting…' : `Feature my campaign — ${money(priceCents)}`}
      </button>
    </div>
  );
}
