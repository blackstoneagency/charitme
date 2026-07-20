'use client';

import { useState } from 'react';

// Lets a campaign owner pay the one-time fee to feature their campaign in the
// homepage rotator. Renders a status badge once featured, otherwise a button
// that starts Stripe Checkout via /api/campaigns/:id/feature.
export default function FeatureCampaignButton({
  campaignId,
  featured,
  priceLabel,
}: {
  campaignId: string;
  featured: boolean;
  priceLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (featured) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px',
          borderRadius: 10, background: 'var(--green-light, #e8f8ee)', color: 'var(--green-dark, #08763b)',
          fontSize: 13, fontWeight: 800,
        }}
      >
        ⭐ Featured campaign
      </span>
    );
  }

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/feature`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not start checkout');
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setLoading(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px',
          borderRadius: 10, border: 'none', cursor: loading ? 'default' : 'pointer',
          background: 'linear-gradient(135deg, var(--violet, #6c35ff), #4d1ee0)', color: '#fff',
          fontSize: 13, fontWeight: 800, opacity: loading ? 0.7 : 1,
        }}
      >
        ⭐ {loading ? 'Redirecting…' : `Feature this campaign — ${priceLabel}`}
      </button>
      {error && <span style={{ fontSize: 12, color: 'var(--red-text, #c42d49)', fontWeight: 600 }}>{error}</span>}
    </span>
  );
}
