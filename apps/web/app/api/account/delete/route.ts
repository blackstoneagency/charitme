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
import { TOMBSTONE_PROFILE_ID, TOMBSTONE_REASSIGNMENTS } from '../../../../lib/deletion-cascade';

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
 *   1. REASSIGN the six columns that lead to money to the tombstone profile,
 *      so the cascade below finds nothing of value attached to this account.
 *   2. Anonymise the profile, so identity is gone even if step 4 fails.
 *   3. Detach donations the user MADE from their identity.
 *   4. Delete the auth user LAST, once nothing is left to cascade into.
 *
 * A failure between 1 and 4 leaves an anonymised account that can still sign in
 * — recoverable, and visibly wrong. The reverse order leaves financial records
 * destroyed and nothing to notice it.
 *
 * ⚠️ Step 1 must verify the tombstone EXISTS before touching anything. If the
 * migration has not been applied, reassigning to a missing profile fails on a
 * foreign key — but only for some of the six tables, leaving the account half
 * moved with no way back. Checked first, refused as a whole.
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

  // Is the tombstone there? Without it, reassignment is impossible and deleting
  // would cascade — so this is a precondition, not a detail.
  let tombstonePresent: boolean | null = null;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', TOMBSTONE_PROFILE_ID)
      .maybeSingle();
    // `null` on error, never `false`: "we could not check" is not "it is absent",
    // and both refuse, but only one of them is worth alerting on.
    tombstonePresent = error ? null : Boolean(data);
  } catch {
    tombstonePresent = null;
  }

  const refusal = refusalFor({ tombstonePresent }, { enabled, confirmed });
  if (refusal) {
    const status = refusal === 'NOT_CONFIRMED' ? 400 : refusal === 'TOMBSTONE_MISSING' ? 503 : 409;
    return NextResponse.json({ error: refusalMessage(refusal), code: refusal }, { status });
  }

  // 1. Move everything that leads to money onto the tombstone.
  //
  // The set is derived from the schema in `lib/deletion-cascade.ts` and pinned
  // by a test, because four of the six paths are long enough that nobody would
  // find them by reading the schema — `creator_profiles -> digital_products ->
  // product_orders` among them.
  for (const { table, column } of TOMBSTONE_REASSIGNMENTS) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ [column]: TOMBSTONE_PROFILE_ID })
      .eq(column, user.id);
    if (error) {
      console.warn('[account-delete] reassignment failed', { table, column, code: error.code });
      // Stop before the delete. A partial reassignment is recoverable; a delete
      // after a partial reassignment is not.
      return NextResponse.json(
        { error: 'Could not delete your account', code: 'REASSIGN_FAILED' },
        { status: 503 },
      );
    }
  }

  // 2. Identity.
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
  //
  // ⚠️ A 404 here is SUCCESS, not failure. Measured against production: the Auth
  // Admin API returns 404 for users whose `auth.users` row was inserted by SQL
  // rather than created through signup — 8 of 8 sampled profiles and 5 of 5
  // sampled campaign owners. Those rows genuinely exist (inserting a profile
  // with no auth row is rejected with 23503, so the foreign key is enforced);
  // GoTrue just cannot see them.
  //
  // Treating that as PARTIAL would tell a user their account was only half
  // deleted, and send them to support, when the outcome they asked for has been
  // achieved: the identity is anonymised and no sign-in is possible either way.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  const alreadyGone =
    authError?.status === 404 || /user not found/i.test(authError?.message ?? '');
  if (authError && !alreadyGone) {
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
