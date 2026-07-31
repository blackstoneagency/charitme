// ─────────────────────────────────────────────────────────────────────────────
// Distance maths for proximity discovery.
//
// Pure, so it can be tested without a database. Every function here is a place
// where a plausible-looking wrong answer is possible — a swapped argument, a
// degrees/radians mixup, a bounding box that collapses near the poles — and none
// of those throw. They just return the wrong campaigns, which looks like a
// working feature.
// ─────────────────────────────────────────────────────────────────────────────

export interface Point {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_MILES = 3958.7613;
export const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** A latitude/longitude pair that is actually on Earth. */
export function isValidPoint(p: Partial<Point> | null | undefined): p is Point {
  if (!p) return false;
  const { lat, lng } = p;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Great-circle distance in miles.
 *
 * Haversine rather than the simpler spherical law of cosines: the latter loses
 * precision for small distances because `acos` of a value very close to 1 is
 * numerically unstable — and small distances ("within 5 miles") are exactly what
 * this feature is for.
 */
export function haversineMiles(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  /** True when the box spans the ±180° meridian and must be queried as two ranges. */
  wrapsAntimeridian: boolean;
}

/**
 * A latitude/longitude box that CONTAINS every point within `miles` of `centre`.
 *
 * This is a pre-filter for the SQL query, not the answer — it over-selects (a box
 * always contains its inscribed circle) and the caller refines with
 * `haversineMiles`. Over-selecting is the safe direction; a box that under-selects
 * would silently drop real results.
 *
 * ⚠️ Longitude degrees shrink as latitude rises: one degree of longitude is ~69
 * miles at the equator and ~0 at the poles, so the span is divided by
 * `cos(latitude)`. Forgetting that produces a box far too narrow in Alaska or
 * Patagonia, which reads as "no campaigns near me" rather than as a bug.
 */
export function boundingBox(centre: Point, miles: number): BoundingBox {
  const latDelta = miles / 69.0;

  // Guard the division: cos(90°) is 0, and near the poles the required longitude
  // span exceeds the whole globe. Clamp to the full range rather than dividing by
  // something approaching zero and producing Infinity.
  const cosLat = Math.cos(toRad(centre.lat));
  const lngDelta = cosLat < 1e-6 ? 180 : Math.min(180, miles / (69.0 * cosLat));

  const minLat = Math.max(-90, centre.lat - latDelta);
  const maxLat = Math.min(90, centre.lat + latDelta);

  let minLng = centre.lng - lngDelta;
  let maxLng = centre.lng + lngDelta;
  let wrapsAntimeridian = false;

  if (lngDelta >= 180) {
    // The box covers every longitude — latitude alone constrains it.
    minLng = -180;
    maxLng = 180;
  } else if (minLng < -180 || maxLng > 180) {
    // The box straddles the date line. `lng between minLng and maxLng` is FALSE
    // for every row once the bounds are normalised (min > max), so a caller that
    // ignores this flag silently returns nothing for anyone near Fiji.
    wrapsAntimeridian = true;
    minLng = ((minLng + 540) % 360) - 180;
    maxLng = ((maxLng + 540) % 360) - 180;
  }

  return { minLat, maxLat, minLng, maxLng, wrapsAntimeridian };
}

/** Human-readable distance: "0.4 mi", "3.2 mi", "18 mi". */
export function formatDistance(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return '';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
