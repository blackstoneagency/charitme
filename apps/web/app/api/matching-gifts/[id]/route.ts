import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';
import { canTransitionMatchingGift, isMatchingGiftStatus, type MatchingGiftStatus } from '../../../../lib/matching-gifts';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  status: z.enum(['submitted', 'requested_from_employer', 'approved', 'received', 'declined', 'cancelled']).optional(),
  employerReference: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
}).refine((v) => v.status !== undefined || v.employerReference !== undefined || v.note !== undefined, {
  message: 'No fields to update',
});

// PATCH /api/matching-gifts/:id
// Donor (owner), campaign organizer, or admin advances/annotates a claim.
// Status changes are validated against the claim lifecycle state machine.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: claim, error: claimError } = await supabaseAdmin
    .from('matching_gift_claims')
    .select('id, donor_id, campaign_id, status')
    .eq('id', id)
    .maybeSingle();
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Authorization: donor, campaign organizer, or admin.
  const admin = await isAdmin(user.id, user.email);
  let organizer = false;
  if (!admin && claim.donor_id !== user.id) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('user_id')
      .eq('id', claim.campaign_id)
      .maybeSingle();
    organizer = campaign?.user_id === user.id;
  }
  const isOwner = claim.donor_id === user.id;
  if (!admin && !organizer && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const update: Record<string, unknown> = {};

  if (parsed.data.status !== undefined) {
    const next = parsed.data.status as MatchingGiftStatus;
    const current = isMatchingGiftStatus(claim.status) ? claim.status : 'submitted';
    if (!canTransitionMatchingGift(current, next)) {
      return NextResponse.json({ error: `Cannot change status from ${current} to ${next}`, code: 'INVALID_TRANSITION' }, { status: 409 });
    }
    // Donors (who aren't also organizer/admin) may only cancel their own claim.
    if (isOwner && !organizer && !admin && next !== 'cancelled' && next !== current) {
      return NextResponse.json({ error: 'Donors can only cancel a claim; the employer/organizer updates its progress', code: 'DONOR_CANCEL_ONLY' }, { status: 403 });
    }
    update.status = next;
  }

  if (parsed.data.employerReference !== undefined) update.employer_reference = parsed.data.employerReference;
  if (parsed.data.note !== undefined) update.note = parsed.data.note;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('matching_gift_claims')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ claim: updated });
}
