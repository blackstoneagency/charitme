import 'server-only';
import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireApiKey, readPaging, apiList, apiError } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/donations — donations received by the caller's campaigns.
//
// ⚠️ TWO privacy rules are enforced here, and neither is optional.
//
// 1. SCOPED TO THE CALLER'S CAMPAIGNS. The campaign ids are resolved from
//    `user_id = owner`, and the donations query filters `campaign_id IN` that
//    set. An `?campaign_id=` parameter is accepted but INTERSECTED with the set
//    rather than trusted — otherwise it is an IDOR that reads any campaign's
//    donor list.
//
// 2. ANONYMOUS DONORS STAY ANONYMOUS — and so do donors whose account-wide
//    Profile Visibility is off. Two separate signals, both honoured:
//      * `donations.anonymous` — this gift was given anonymously
//      * `profiles.show_public_profile` — this PERSON is private everywhere
//    Settings describes the second as governing "who can see your giving
//    activity", and every other profile join in this repo consults it (the
//    leaderboard shipped without it once and named private donors in
//    server-rendered HTML). A public API is the last place to invent an
//    exception: these rows get piped into third-party tools by definition.
//    The amount always appears — the organizer is entitled to their own
//    financial record. It is the identity that is protected, not the money.

interface DonationRow {
  id: string;
  campaign_id: string;
  amount_cents: number;
  tip_cents: number | null;
  status: string;
  anonymous: boolean | null;
  donor_id: string | null;
  message: string | null;
  created_at: string;
  profiles?: ProfileLite | ProfileLite[] | null;
}

type ProfileLite = { full_name?: string | null; show_public_profile?: boolean | null };

/** True when this row may name the donor at all. */
function isIdentityVisible(row: DonationRow): boolean {
  if (row.anonymous) return false;
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  // Defaults to true: the column is null on older rows, and nobody who never
  // touched the setting intended to be hidden.
  return (p?.show_public_profile ?? true) === true;
}

function donorName(row: DonationRow): string | null {
  if (!isIdentityVisible(row)) return null;
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return p?.full_name ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request, 'donations:read');
  if (!auth.ok) return auth.response;

  const paging = readPaging(request);
  const url = new URL(request.url);
  const requestedCampaignId = url.searchParams.get('campaign_id');

  const { data: owned, error: ownedError } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('user_id', auth.ctx.ownerId);

  if (ownedError) return apiError(500, 'internal_error', 'Could not load your campaigns.');

  let ids = ((owned ?? []) as { id: string }[]).map((c) => c.id);

  if (requestedCampaignId) {
    // Intersect, never replace. A campaign the caller does not own simply yields
    // an empty set — the same answer as a campaign with no donations, so the
    // endpoint does not confirm whether someone else's id exists.
    ids = ids.filter((id) => id === requestedCampaignId);
  }

  if (ids.length === 0) return apiList([], paging, 0);

  const { data, error, count } = await supabaseAdmin
    .from('donations')
    .select(
      'id, campaign_id, amount_cents, tip_cents, status, anonymous, donor_id, message, created_at, profiles:donor_id(full_name, show_public_profile)',
      { count: 'exact' },
    )
    .in('campaign_id', ids)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(paging.offset, paging.offset + paging.limit - 1);

  if (error) return apiError(500, 'internal_error', 'Could not load donations.');

  const out = ((data ?? []) as DonationRow[]).map((d) => ({
    id: d.id,
    campaign_id: d.campaign_id,
    amount_cents: d.amount_cents,
    tip_cents: d.tip_cents ?? 0,
    status: d.status,
    anonymous: Boolean(d.anonymous),
    donor_name: donorName(d),
    // Withheld whenever the name is: the id is a stable handle that would let a
    // caller correlate a hidden donor across campaigns and re-identify them,
    // which would make the name redaction above cosmetic.
    donor_id: isIdentityVisible(d) ? d.donor_id : null,
    message: d.message,
    created_at: d.created_at,
  }));

  return apiList(out, paging, count ?? null);
}
