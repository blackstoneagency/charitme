import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { getProgram } from '../../../../../lib/matching';
import { ProgramUpdateSchema } from '../../../../../lib/matching-core';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/matching/programs/:id
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ program });
}

// PATCH /api/matching/programs/:id — sponsor edits / changes status.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabaseAdmin
    .from('matching_programs')
    .select('sponsor_id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.sponsor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ProgramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const patch: Record<string, unknown> = {};
  if (input.company_name !== undefined) patch.company_name = input.company_name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.match_ratio !== undefined) patch.match_ratio = input.match_ratio;
  if (input.annual_cap_cents !== undefined) patch.annual_cap_cents = input.annual_cap_cents;
  if (input.min_donation_cents !== undefined) patch.min_donation_cents = input.min_donation_cents;
  if (input.categories !== undefined) patch.categories = input.categories.map((c) => c.trim()).filter(Boolean);
  if (input.currency !== undefined) patch.currency = input.currency.toUpperCase();
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('matching_programs').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
