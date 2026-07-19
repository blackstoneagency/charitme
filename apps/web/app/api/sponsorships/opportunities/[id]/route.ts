import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { getOpportunity } from '../../../../../lib/sponsorships';
import { OpportunityUpdateSchema } from '../../../../../lib/sponsorships-core';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/sponsorships/opportunities/:id
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ opportunity });
}

// PATCH /api/sponsorships/opportunities/:id — organizer edits / changes status.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select('organizer_id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.organizer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = OpportunityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.category !== undefined) patch.category = input.category;
  if (input.benefits !== undefined) patch.benefits = input.benefits;
  if (input.min_amount_cents !== undefined) patch.min_amount_cents = input.min_amount_cents;
  if (input.target_amount_cents !== undefined) patch.target_amount_cents = input.target_amount_cents;
  if (input.currency !== undefined) patch.currency = input.currency.toUpperCase();
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('sponsorship_opportunities').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
