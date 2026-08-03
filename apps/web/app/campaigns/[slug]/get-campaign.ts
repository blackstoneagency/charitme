import { cache } from 'react';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';

// `select('*')` with an embedded relation is untyped in supabase-js without
// generated DB types, so this row was already `any` at every call site. Kept
// permissive on purpose: narrowing it here would be a large, unrelated refactor
// of the busiest page on the site, and this change is about failure handling.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CampaignRow = { id: string; slug: string; user_id: string } & Record<string, any>;

/**
 * Why this returns a RESULT rather than `Campaign | null`.
 *
 * Every caller used to read `null` as "no such campaign" and call `notFound()`.
 * But `null` also came back when the read itself failed — `supabaseAdmin` is a
 * Proxy that throws synchronously when its env vars are missing, and a timeout
 * or a network fault resolves to `{ data: null }` too. So a database problem
 * told visitors that a live campaign **does not exist**.
 *
 * That is worse than an error page, and worst of all here: this is the donation
 * path. A 404 is a factual claim ("there is nothing at this URL") that gets
 * cached, shared and indexed. "We could not load this campaign" is the truth.
 */
export type CampaignResult =
  | { ok: true; campaign: CampaignRow }
  | { ok: false; reason: 'missing' | 'unavailable' };

// Memoized per-request. layout.tsx, generateMetadata and the page all call this,
// and React cache() dedupes them to a single query on the highest-traffic public
// page — so the layout's existence gate below costs no extra round-trip.
export const getCampaignResult = cache(async (slug: string): Promise<CampaignResult> => {
  const { data, error } = await boundedQuery(() =>
    supabaseAdmin
      .from('campaigns')
      .select('*, profiles:user_id (full_name, avatar_url)')
      .eq('slug', slug)
      // Soft-deleted campaigns must 404 like missing ones. DELETE
      // /api/campaigns/[id] sets deleted_at rather than removing the row ("for
      // compliance audit trail"), and every listing filters it — but this fetch
      // did not, so a deleted campaign stayed fully readable at its public URL:
      // story, donor names and messages, amount raised. Deleting appeared to work
      // because the campaign vanished from listings, while anyone holding the link
      // (or a search-engine result) could still open it.
      .is('deleted_at', null)
      .maybeSingle(),
  );

  if (data) return { ok: true, campaign: data as CampaignRow };
  // `.maybeSingle()` returns `{ data: null, error: null }` for "no row" — that,
  // and only that, is a genuinely missing campaign. Any error at all (including
  // the QUERY_UNAVAILABLE the boundedQuery thunk synthesises when the client
  // itself cannot be built) means we do not know whether it exists.
  return { ok: false, reason: error ? 'unavailable' : 'missing' };
});

/**
 * Back-compat accessor for callers that only need the row.
 *
 * `null` here means MISSING only. An unavailable read throws, so no caller can
 * silently turn an outage into a 404 by forgetting to check — the loud failure
 * is deliberate, and `assertCampaignExists` below is the supported way to
 * handle it.
 */
export async function getCampaign(slug: string): Promise<CampaignRow | null> {
  const result = await getCampaignResult(slug);
  if (result.ok) return result.campaign;
  if (result.reason === 'missing') return null;
  throw new Error(`campaign read unavailable for slug "${slug}"`);
}

/**
 * Existence gate used by the campaign detail layout: raises Next's not-found
 * signal when the slug has no campaign, and returns normally when it does.
 *
 * On an UNAVAILABLE read it returns normally too, deliberately — the child
 * segment renders the "temporarily unavailable" state instead. Throwing here
 * would replace the friendly state with a crash, because an `error.tsx` inside
 * this segment cannot catch a throw from this segment's own layout.
 *
 * Lives here (a plain .ts module) rather than inline in layout.tsx so the
 * decision is unit-testable without rendering a server component — see
 * `__tests__/campaign-existence-gate.test.ts`. That matters because this sits
 * on the donation path: the "missing → 404" half is verifiable from a local
 * build, but "real campaign → renders" otherwise rests on reasoning alone.
 */
export async function assertCampaignExists(slug: string): Promise<void> {
  const result = await getCampaignResult(slug);
  if (!result.ok && result.reason === 'missing') notFound();
}
