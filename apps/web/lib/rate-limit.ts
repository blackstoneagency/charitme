// ─────────────────────────────────────────────────────────────────────────────
// Process-local (in-memory) rate limiter.
//
// IMPORTANT: this is per-process. On serverless/multi-instance deployments
// (Vercel, etc.) each instance keeps its own counter, so the effective global
// limit is `limit × instanceCount`. Use it for cheap, best-effort throttling
// and as the fallback path for `checkRateLimitDurable` (see rate-limit-durable.ts),
// which enforces a real cross-instance limit via Postgres.
// ─────────────────────────────────────────────────────────────────────────────

const hits = new Map<string, { count: number; resetAt: number }>();

// Bound memory: sweep expired entries periodically instead of letting the map
// grow unbounded across the life of a warm instance.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function maybeSweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, v] of hits) {
    if (v.resetAt <= now) hits.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  maybeSweep(now);
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

// Exposed for tests / diagnostics.
export function _rateLimitSize(): number {
  return hits.size;
}

export function _rateLimitReset(): void {
  hits.clear();
  lastSweep = 0;
}
