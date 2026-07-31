import { cache } from 'react';
import { supabaseAdmin } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Is peer-to-peer attribution live on THIS deployment?
//
// ⚠️ This exists to protect the money path, and the failure it prevents is total.
//
// `record_donation` is called with NAMED arguments. PostgREST resolves the
// overload by those names, so passing `p_peer_fundraiser_id` to a database where
// `20260816000000_record_donation_peer_attribution.sql` has NOT run does not
// degrade — it fails to resolve any function at all (PGRST202). The webhook
// rethrows so Stripe retries, so it would retry forever. That breaks EVERY
// donation, not merely peer-attributed ones, for as long as the code is ahead of
// the migration.
//
// Vercel deploys from `master` on push; migrations run through a separate
// release workflow. So "code ahead of schema" is not a hypothetical ordering —
// it is the DEFAULT ordering, and this is the guard for it.
//
// Probing the column rather than the function signature: PostgREST will not
// introspect a function's arguments over REST, but `donations.peer_fundraiser_id`
// and the new signature ship in the same migration pair, and a select on a
// missing column answers `42703`. Same technique as `lib/campaign-visibility.ts`.
//
// Memoized per request. It is one HEAD-shaped query, but the webhook is on the
// hot path for every payment and this must not add a round-trip per call.
// ─────────────────────────────────────────────────────────────────────────────

const memoize: <A extends unknown[], R>(fn: (...a: A) => R) => (...a: A) => R =
  typeof cache === 'function' ? cache : (fn) => fn;

export const peerAttributionLive = memoize(async (): Promise<boolean> => {
  try {
    const { error } = await supabaseAdmin.from('donations').select('peer_fundraiser_id').limit(1);
    return !error;
  } catch {
    // Fail CLOSED. An unreachable database here must not be read as "the column
    // is there" — that would send the extra argument and break the very
    // donations this is meant to protect.
    return false;
  }
});

/**
 * The peer argument for a `record_donation` call, as a spreadable object.
 *
 * Returns `{}` when attribution is not live, so the call keeps the exact 10-key
 * shape the deployed function expects. The donation is then recorded as a direct
 * gift — the money still reaches the campaign in full, only the per-supporter
 * split is missed, which is the correct thing to lose.
 */
export async function peerRpcArg(
  peerFundraiserId: string | null | undefined,
): Promise<{ p_peer_fundraiser_id?: string | null }> {
  if (!(await peerAttributionLive())) return {};
  return { p_peer_fundraiser_id: peerFundraiserId || null };
}
