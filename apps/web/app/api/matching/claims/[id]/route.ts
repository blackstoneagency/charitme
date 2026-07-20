import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import {
  ClaimUpdateSchema,
  canTransitionClaim,
  type ClaimActor,
  type ClaimStatus,
} from '../../../../../lib/matching-core';
import { notify } from '../../../../../lib/notify';
import { matchingClaimResolved } from '../../../../../lib/notify-core';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/matching/claims/:id — sponsor approves / declines / marks paid.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: claim } = await supabaseAdmin
    .from('matching_claims')
    .select('id, program_id, employee_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: program } = await supabaseAdmin
    .from('matching_programs')
    .select('sponsor_id, company_name')
    .eq('id', claim.program_id)
    .maybeSingle();
  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

  const isSponsor = program.sponsor_id === user.id;
  const isEmployee = claim.employee_id === user.id;
  if (!isSponsor && !isEmployee) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const actor: ClaimActor = isSponsor ? 'sponsor' : 'employee';

  const body = await request.json().catch(() => null);
  const parsed = ClaimUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { status } = parsed.data;

  if (!canTransitionClaim(actor, claim.status as ClaimStatus, status)) {
    return NextResponse.json(
      { error: `A ${actor} cannot move a claim from ${claim.status} to ${status}` },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { status };
  if (status === 'approved' || status === 'declined' || status === 'paid') {
    patch.reviewer_id = user.id;
    patch.resolved_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin.from('matching_claims').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the employee when the company resolves their match claim.
  if (isSponsor) {
    await notify(claim.employee_id, matchingClaimResolved(status, (program.company_name as string) ?? 'Your employer'), { claim_id: id });
  }

  return NextResponse.json({ ok: true });
}
