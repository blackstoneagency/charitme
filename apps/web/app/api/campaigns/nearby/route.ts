import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../../../lib/campaign-visibility';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { boundingBox, haversineMiles, isValidPoint } from '../../../../lib/geo';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns near a point.
//
// Two-stage by design: a bounding box in SQL (indexed, cheap, over-selects) then
// an exact haversine refine in JS. See lib/geo.ts for why the box is not the
// answer on its own.
//
// ⚠️ Degrades rather than 500s when `campaigns.latitude` does not exist.
// `20260817000000_campaign_geolocation.sql` may not be applied on a given
// deployment, and PostgREST answers a select on a missing column with 42703. A
// discovery endpoint that hard-fails would take the page down; instead it
// reports `available: false` and the page says proximity search is not switched
// on here. That distinction — "no campaigns near you" versus "this deployment
// cannot answer that" — is the one this repo keeps finding collapsed.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RADIUS_MILES = 500;
const DEFAULT_RADIUS_MILES = 25;
const MAX_RESULTS = 40;
// The box over-selects, so fetch more than we return, then refine and trim.
const CANDIDATE_LIMIT = 300;

interface Row {
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
  latitude: number | null;
  longitude: number | null;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`campaigns-nearby:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const url = new URL(request.url);
  const rawLat = url.searchParams.get('lat');
  const rawLng = url.searchParams.get('lng');

  // ⚠️ Presence is checked BEFORE conversion. `Number(null)` is 0 and
  // `Number('')` is 0, so a request with no coordinates at all would otherwise
  // become the perfectly valid point (0, 0) — which is in the Gulf of Guinea —
  // and answer "no campaigns near you" instead of "you didn't say where you
  // are". The geolocation migration warns about exactly this NULL-as-zero
  // reading; it applies just as much to a query string.
  if (rawLat === null || rawLng === null || rawLat.trim() === '' || rawLng.trim() === '') {
    return NextResponse.json(
      { error: 'A valid lat and lng are required.', code: 'INVALID_INPUT' },
      { status: 400 },
    );
  }

  const centre = { lat: Number(rawLat), lng: Number(rawLng) };

  if (!isValidPoint(centre)) {
    return NextResponse.json({ error: 'A valid lat and lng are required.', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const radius = Math.min(
    MAX_RADIUS_MILES,
    Math.max(1, Number(url.searchParams.get('radius')) || DEFAULT_RADIUS_MILES),
  );

  const box = boundingBox(centre, radius);
  const cols = await campaignColumns();

  let query = applyLiveFilters(
    supabaseAdmin
      .from('campaigns')
      .select(
        'id, slug, title, tagline, cover_image_url, category, location, goal_amount, raised_amount, backer_count, latitude, longitude',
      ),
    cols,
  )
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', box.minLat)
    .lte('latitude', box.maxLat);

  if (box.wrapsAntimeridian) {
    // min > max here, so a plain range matches nothing. Split into the two arcs
    // either side of the date line.
    query = query.or(`longitude.gte.${box.minLng},longitude.lte.${box.maxLng}`);
  } else {
    query = query.gte('longitude', box.minLng).lte('longitude', box.maxLng);
  }

  const { data, error } = await query.limit(CANDIDATE_LIMIT);

  if (error) {
    // 42703 = undefined_column: the geolocation migration has not been applied.
    if ((error as { code?: string }).code === '42703') {
      return NextResponse.json(
        {
          available: false,
          campaigns: [],
          reason: 'Proximity search is not enabled on this deployment yet.',
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  const campaigns = ((data ?? []) as Row[])
    .map((c) => {
      if (c.latitude === null || c.longitude === null) return null;
      const point = { lat: c.latitude, lng: c.longitude };
      if (!isValidPoint(point)) return null;
      const distanceMiles = haversineMiles(centre, point);
      return { ...c, distanceMiles };
    })
    .filter((c): c is Row & { distanceMiles: number } => c !== null && c.distanceMiles <= radius)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, MAX_RESULTS);

  return NextResponse.json(
    { available: true, radius, campaigns },
    // Varies by coordinate, so this is a per-caller answer — cached briefly in
    // the browser only, never shared at the CDN.
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
