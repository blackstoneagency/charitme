import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { listEmployeeClaims, listProgramClaims, reservedMatchForEmployee, MatchCapUnavailableError } from '../../../../lib/matching';
import {
  ClaimCreateSchema,
  computeMatchAmount,
  remainingCap,
  categoryEligible,
  isAcceptingClaims,
} from '../../../../lib/matching-core';
import { notify } from '../../../../lib/notify';
import { matchingClaimReceived } from '../../../../lib/notify-core';
import { formatMoneyShort } from '@shared/currencies';

// GET /api/matching/claims           -> the signed-in employee's claims
// GET /api/matching/claims?programId= -> claims to a program the user sponsors
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const programId = new URL(request.url).searchParams.get('programId');
  if (programId) {
    const { data: program } = await supabaseAdmin
      .from('matching_programs')
      .select('sponsor_id')
      .eq('id', programId)
      .maybeSingle();
    if (!program || program.sponsor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ claims: await listProgramClaims(programId) });
  }

  return NextResponse.json({ claims: await listEmployeeClaims(user.id) });
}

// POST /api/matching/claims — employee submits a match claim for a donation.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = ClaimCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const { data: program } = await supabaseAdmin
    .from('matching_programs')
    .select('sponsor_id, status, match_ratio, annual_cap_cents, min_donation_cents, categories, company_name, currency')
    .eq('id', input.program_id)
    .maybeSingle();
  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  if (!isAcceptingClaims(program)) {
    return NextResponse.json({ error: 'This program is not accepting claims' }, { status: 409 });
  }
  if (input.donation_amount_cents < program.min_donation_cents) {
    return NextResponse.json(
      { error: `Minimum donation for this program is ${program.min_donation_cents} cents` },
      { status: 400 },
    );
  }

  // Category eligibility (only when a campaign is referenced).
  if (input.campaign_id) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('category')
      .eq('id', input.campaign_id)
      .maybeSingle();
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (!categoryEligible(program.categories as string[], campaign.category as string)) {
      return NextResponse.json({ error: 'This campaign’s category is not eligible for this program' }, { status: 400 });
    }
  }

  // A claim commits the sponsor's money, so it must never be computed against an
  // unknown cap usage — see MatchCapUnavailableError.
  let used: number;
  try {
    used = await reservedMatchForEmployee(input.program_id, user.id);
  } catch (err) {
    if (err instanceof MatchCapUnavailableError) {
      return NextResponse.json(
        { error: 'We could not check your remaining match allowance. Nothing was submitted — please try again.', code: 'MATCH_CAP_UNAVAILABLE' },
        { status: 503 },
      );
    }
    throw err;
  }
  const remaining = remainingCap(program.annual_cap_cents as number, used);
  const matchAmount = computeMatchAmount({
    donationCents: input.donation_amount_cents,
    matchRatio: Number(program.match_ratio),
    minDonationCents: program.min_donation_cents as number,
    remainingCapCents: remaining,
  });

  const { data, error } = await supabaseAdmin
    .from('matching_claims')
    .insert({
      program_id: input.program_id,
      employee_id: user.id,
      campaign_id: input.campaign_id ?? null,
      donation_id: input.donation_id ?? null,
      donation_amount_cents: input.donation_amount_cents,
      match_amount_cents: matchAmount,
      note: input.note ?? null,
      status: 'pending',
    })
    .select('id, match_amount_cents')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  // Notify the company/program sponsor of the new match claim.
  await notify(
    program.sponsor_id,
    matchingClaimReceived(
      formatMoneyShort(input.donation_amount_cents, (program.currency as string) ?? 'usd'),
      (program.company_name as string) ?? 'your program',
    ),
    { claim_id: data.id },
  );

  return NextResponse.json({ id: data.id, match_amount_cents: data.match_amount_cents }, { status: 201 });
}
