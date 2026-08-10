import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { anonymizedProfilePatch } from '../../../../lib/privacy-core';
import {
  accountSelfDeleteEnabled,
  isConfirmed,
  refusalFor,
  refusalMessage,
} from '../../../../lib/account-deletion';

/**
 * POST /api/account/delete — the user deletes their own account.
 *
 * App Store Guideline 5.1.1(v) requires deletion to be initiated AND completed
 * inside the app. `/privacy-center`'s existing flow files a request for an admin
 * to action, which is accepted only in narrow regulated cases.
 *
 * ⚠️ The ordering below is the whole safety argument, and it is the opposite of
 * the obvious one. See `lib/account-deletion.ts` for the cascade this avoids:
 * deleting the auth user first would take the profile, then the campaigns, then
 * every donation ever made to them.
 *
 *   1. COUNT donations received. Refuse on any number but zero — including
 *      "could not count".
 *   2. Anonymise the profile, so identity is gone even if step 4 fails.
 *   3. Detach donations the user MADE from their identity.
 *   4. Delete the auth user LAST, once nothing is left to cascade into.
 *
 * A failure between 2 and 4 leaves an anonymised account that can still sign in
 * — recoverable, and visibly wrong. The reverse order leaves financial records
 * destroyed and nothing to notice it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const enabled = accountSelfDeleteEnabled();
  // 404 rather than 403 when the feature is off: a disabled feature should not
  // advertise that it exists.
  if (!enabled) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  const confirmed = isConfirmed(body?.confirm);

  // Donations RECEIVED — via the campaigns this account owns. A head-only exact
  // count: it transfers no rows and cannot be a sample.
  let donationsReceived: number | null = null;
  try {
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', user.id);
    if (campaignsError) throw campaignsError;

    const campaignIds = (campaigns ?? []).map((c) => c.id as string);
    if (campaignIds.length === 0) {
      donationsReceived = 0;
    } else {
      const { count, error } = await supabaseAdmin
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds);
      if (error) throw error;
      // `count` is `number | null`; a null count is an unknown, not a zero, and
      // `refusalFor` refuses on it.
      donationsReceived = count;
    }
  } catch {
    donationsReceived = null;
  }

  const refusal = refusalFor({ donationsReceived }, { enabled, confirmed });
  if (refusal) {
    const status = refusal === 'NOT_CONFIRMED' ? 400 : 409;
    return NextResponse.json({ error: refusalMessage(refusal), code: refusal }, { status });
  }

  // 2. Identity first.
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update(anonymizedProfilePatch(user.id))
    .eq('id', user.id);
  if (profileError) {
    console.warn('[account-delete] profile anonymisation failed', { code: profileError.code });
    return NextResponse.json({ error: 'Could not delete your account', code: 'WRITE_FAILED' }, { status: 503 });
  }

  // 3. Donations the user MADE. `donor_id` is ON DELETE SET NULL so this would
  // happen anyway, but doing it explicitly keeps the behaviour true if that
  // constraint is ever tightened — and makes the retained record's shape a
  // decision rather than a side effect.
  const { error: donationError } = await supabaseAdmin
    .from('donations')
    .update({ donor_id: null, anonymous: true })
    .eq('donor_id', user.id);
  if (donationError) {
    console.warn('[account-delete] donation detach failed', { code: donationError.code });
    return NextResponse.json({ error: 'Could not delete your account', code: 'WRITE_FAILED' }, { status: 503 });
  }

  // 4. Only now is there nothing left for the cascade to reach.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.warn('[account-delete] auth user delete failed', { message: authError.message });
    return NextResponse.json(
      { error: 'Your data was removed but the sign-in could not be closed. Contact support.', code: 'PARTIAL' },
      { status: 503 },
    );
  }

  // Audit trail, best effort. The row outlives the account deliberately: it
  // records that a deletion happened without naming who.
  await supabaseAdmin.from('privacy_requests').insert({
    user_id: null,
    type: 'deletion',
    status: 'completed',
    resolved_at: new Date().toISOString(),
    resolution_note: 'Self-service deletion completed by the account holder.',
  });

  return NextResponse.json({ ok: true });
}
