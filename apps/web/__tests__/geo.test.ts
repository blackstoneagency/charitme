import { describe, it, expect } from 'vitest';
import { haversineMiles, boundingBox, isValidPoint, formatDistance } from '../lib/geo';

// Distance maths fails quietly: a swapped argument or a degrees/radians mixup
// returns a number, renders fine, and just lists the wrong campaigns. These
// assert against known real-world distances so a wrong answer is visible.

const AUSTIN = { lat: 30.2672, lng: -97.7431 };
const HOUSTON = { lat: 29.7604, lng: -95.3698 };
const NYC = { lat: 40.7128, lng: -74.006 };
const LONDON = { lat: 51.5074, lng: -0.1278 };

describe('haversineMiles', () => {
  it('matches known distances within 1%', () => {
    // Austin → Houston ≈ 146 mi; NYC → London ≈ 3459 mi.
    expect(haversineMiles(AUSTIN, HOUSTON)).toBeGreaterThan(144);
    expect(haversineMiles(AUSTIN, HOUSTON)).toBeLessThan(148);
    expect(haversineMiles(NYC, LONDON)).toBeGreaterThan(3430);
    expect(haversineMiles(NYC, LONDON)).toBeLessThan(3490);
  });

  it('is zero for a point to itself, and symmetric', () => {
    expect(haversineMiles(AUSTIN, AUSTIN)).toBeCloseTo(0, 6);
    expect(haversineMiles(AUSTIN, NYC)).toBeCloseTo(haversineMiles(NYC, AUSTIN), 6);
  });

  it('handles a pair straddling the date line without going the long way round', () => {
    // 179.9°E to 179.9°W is ~14 miles apart at the equator, not ~12,400.
    const west = { lat: 0, lng: 179.9 };
    const east = { lat: 0, lng: -179.9 };
    expect(haversineMiles(west, east)).toBeLessThan(20);
  });

  it('stays finite at the poles', () => {
    expect(Number.isFinite(haversineMiles({ lat: 90, lng: 0 }, { lat: -90, lng: 0 }))).toBe(true);
  });
});

describe('boundingBox', () => {
  it('contains every point within the radius — the property that matters', () => {
    // The box is a pre-filter. If it excludes a point inside the circle, that
    // campaign is silently missing from the results and nothing reports it.
    const radius = 25;
    const box = boundingBox(AUSTIN, radius);
    for (let bearing = 0; bearing < 360; bearing += 15) {
      const rad = (bearing * Math.PI) / 180;
      // A point just inside the radius, in each direction.
      const d = radius * 0.98;
      const lat = AUSTIN.lat + (d / 69) * Math.cos(rad);
      const lng = AUSTIN.lng + (d / (69 * Math.cos((AUSTIN.lat * Math.PI) / 180))) * Math.sin(rad);
      expect(lat, `lat at ${bearing}°`).toBeGreaterThanOrEqual(box.minLat);
      expect(lat, `lat at ${bearing}°`).toBeLessThanOrEqual(box.maxLat);
      expect(lng, `lng at ${bearing}°`).toBeGreaterThanOrEqual(box.minLng);
      expect(lng, `lng at ${bearing}°`).toBeLessThanOrEqual(box.maxLng);
    }
  });

  it('widens the longitude span at high latitude', () => {
    // One degree of longitude is much shorter near the poles, so the same radius
    // needs a WIDER degree span. A box that ignores this is too narrow and
    // returns nothing in Alaska.
    const equator = boundingBox({ lat: 0, lng: 0 }, 50);
    const arctic = boundingBox({ lat: 70, lng: 0 }, 50);
    const spanOf = (b: { minLng: number; maxLng: number }) => b.maxLng - b.minLng;
    expect(spanOf(arctic)).toBeGreaterThan(spanOf(equator) * 2);
  });

  it('does not divide by zero at the pole', () => {
    const box = boundingBox({ lat: 90, lng: 0 }, 50);
    expect(Number.isFinite(box.minLng)).toBe(true);
    expect(Number.isFinite(box.maxLng)).toBe(true);
    expect(box.minLng).toBe(-180);
    expect(box.maxLng).toBe(180);
  });

  it('flags a box that straddles the antimeridian', () => {
    const box = boundingBox({ lat: 0, lng: 179.9 }, 50);
    expect(box.wrapsAntimeridian).toBe(true);
    // Normalised bounds have min > max — a plain BETWEEN would match nothing,
    // which is precisely why the flag exists.
    expect(box.minLng).toBeGreaterThan(box.maxLng);
  });

  it('does not flag an ordinary box', () => {
    expect(boundingBox(AUSTIN, 25).wrapsAntimeridian).toBe(false);
  });

  it('clamps latitude to the poles rather than exceeding them', () => {
    const box = boundingBox({ lat: 89.9, lng: 0 }, 500);
    expect(box.maxLat).toBeLessThanOrEqual(90);
    expect(box.minLat).toBeGreaterThanOrEqual(-90);
  });
});

describe('isValidPoint', () => {
  it('accepts real coordinates', () => {
    expect(isValidPoint(AUSTIN)).toBe(true);
    expect(isValidPoint({ lat: 0, lng: 0 })).toBe(true);
  });

  it('rejects out-of-range, non-finite, and missing values', () => {
    expect(isValidPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidPoint({ lat: NaN, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: Infinity, lng: 0 })).toBe(false);
    expect(isValidPoint(null)).toBe(false);
    expect(isValidPoint(undefined)).toBe(false);
    expect(isValidPoint({ lat: 1 })).toBe(false);
  });

  it('rejects a swapped pair that lands out of range', () => {
    // The most common geocoding bug. Not all swaps are detectable, but the ones
    // where longitude exceeds 90 are, and they are the majority.
    expect(isValidPoint({ lat: -97.7431, lng: 30.2672 })).toBe(false);
  });
});

describe('formatDistance', () => {
  it('uses one decimal under 10 miles and whole numbers above', () => {
    expect(formatDistance(0.42)).toBe('0.4 mi');
    expect(formatDistance(3.25)).toBe('3.3 mi');
    expect(formatDistance(18.4)).toBe('18 mi');
  });

  it('returns empty for nonsense rather than "NaN mi"', () => {
    expect(formatDistance(NaN)).toBe('');
    expect(formatDistance(-1)).toBe('');
  });
});
