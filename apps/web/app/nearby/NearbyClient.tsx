'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Btn, Card, Select, ProgressBar, EmptyState, Spinner } from '../../components/ui';
import { formatDistance } from '../../lib/geo';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';

// ─────────────────────────────────────────────────────────────────────────────
// Proximity discovery.
//
// Location is requested on an explicit click, never on mount. A page that fires
// the geolocation permission prompt the moment it loads is the pattern browsers
// added permission fatigue warnings for — and a visitor who declines then has a
// page that can do nothing, with no way back. Here, declining leaves the manual
// path intact.
// ─────────────────────────────────────────────────────────────────────────────

interface NearbyCampaign {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_url: string | null;
  category: string;
  location: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  distanceMiles: number;
}

const RADII = [5, 10, 25, 50, 100, 250];

export default function NearbyClient() {
  const [radius, setRadius] = useState(25);
  const [campaigns, setCampaigns] = useState<NearbyCampaign[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [centre, setCentre] = useState<{ lat: number; lng: number } | null>(null);

  async function search(point: { lat: number; lng: number }, miles: number) {
    setLoading(true);
    setError(null);
    setUnavailable(null);
    try {
      const res = await fetch(
        `/api/campaigns/nearby?lat=${point.lat}&lng=${point.lng}&radius=${miles}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not search for nearby campaigns.');
        return;
      }
      // A deployment without the geolocation migration answers 200 with
      // `available: false`. Saying so is not the same as "nothing found".
      if (json.available === false) {
        setUnavailable(json.reason ?? 'Proximity search is not enabled here yet.');
        setCampaigns([]);
        return;
      }
      setCampaigns(json.campaigns ?? []);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share your location. You can still browse all campaigns.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCentre(point);
        void search(point, radius);
      },
      (err) => {
        setLoading(false);
        // Distinguish "you said no" from "it broke" — the first needs a way
        // forward, the second needs a retry.
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was declined. You can browse every campaign instead, or allow location and try again.'
            : 'Your location could not be determined. You can browse every campaign instead.',
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function changeRadius(miles: number) {
    setRadius(miles);
    if (centre) void search(centre, miles);
  }

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 160 }}>
            <Select
              label="Within"
              value={String(radius)}
              onChange={(e) => changeRadius(Number(e.target.value))}
            >
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {r} miles
                </option>
              ))}
            </Select>
          </div>
          <Btn onClick={useMyLocation} loading={loading}>
            {centre ? 'Update my location' : 'Use my location'}
          </Btn>
        </div>

        <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.55 }}>
          Your location is used only to run this search. It is sent with the request and never
          stored on your account.
        </p>

        {error && (
          <p role="alert" style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--red-text)' }}>
            {error}{' '}
            <Link href="/campaigns" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
              Browse all campaigns →
            </Link>
          </p>
        )}

        {unavailable && (
          <p role="status" style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--t2)' }}>
            {unavailable}{' '}
            <Link href="/campaigns" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
              Browse all campaigns →
            </Link>
          </p>
        )}
      </Card>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner />
        </div>
      )}

      {!loading && campaigns !== null && campaigns.length === 0 && !unavailable && !error && (
        <div style={{ marginTop: 20 }}>
          <EmptyState
            title={`No campaigns within ${radius} miles`}
            body="Try a wider radius, or browse every live fundraiser."
          />
        </div>
      )}

      {!loading && campaigns !== null && campaigns.length > 0 && (
        <>
          <p style={{ margin: '22px 0 14px', fontSize: 13.5, color: 'var(--t3)' }}>
            {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'} within {radius} miles,
            closest first
          </p>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: 18,
            }}
          >
            {campaigns.map((c) => (
              <li key={c.id}>
                <Card style={{ padding: 0, overflow: 'hidden', height: '100%' }}>
                  <Link href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                    {c.cover_image_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.cover_image_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--violet-ink)' }}>
                          {formatDistance(c.distanceMiles)} away
                        </span>
                        {c.location && (
                          <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>{c.location}</span>
                        )}
                      </div>
                      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 8px', color: 'var(--t1)', lineHeight: 1.35 }}>
                        {c.title}
                      </h2>
                      <ProgressBar value={c.raised_amount} max={c.goal_amount > 0 ? c.goal_amount : 1} />
                      <p style={{ fontSize: 13, color: 'var(--t2)', margin: '8px 0 0' }}>
                        <strong style={{ color: 'var(--t1)' }}>
                          {formatMoneyShort(c.raised_amount, DEFAULT_CURRENCY)}
                        </strong>{' '}
                        raised
                      </p>
                    </div>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
