import 'server-only';
import { supabaseAdmin } from './supabase';
import { checkRateLimit } from './rate-limit';

// ─────────────────────────────────────────────────────────────────────────────
// Durable, cross-instance rate limiter backed by Postgres (Supabase).
//
// Unlike the in-memory `checkRateLimit`, this enforces one shared counter across
// every serverless instance via the `check_rate_limit` RPC (see migration
// 20260719130000). If the durable store is unavailable — e.g. the migration has
// not been applied yet, or a transient DB error — it degrades gracefully to the
// process-local limiter so an endpoint is never left completely unprotected and
// a DB hiccup never takes the endpoint down.
//
// Returns true if the request is allowed, false if the limit is exceeded.
// ─────────────────────────────────────────────────────────────────────────────
export async function checkRateLimitDurable(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });
    if (error) throw error;
    return data === true;
  } catch {
    // Fall back to per-instance throttling (still better than nothing).
    return checkRateLimit(key, limit, windowMs);
  }
}
