import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { listActivePrograms } from '../../../../lib/matching';
import { ProgramCreateSchema } from '../../../../lib/matching-core';

// GET /api/matching/programs?search=
export async function GET(request: NextRequest) {
  const search = new URL(request.url).searchParams.get('search') ?? undefined;
  return NextResponse.json({ programs: await listActivePrograms(search) });
}

// POST /api/matching/programs — a company creates a matching program.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = ProgramCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('matching_programs')
    .insert({
      sponsor_id: user.id,
      company_name: input.company_name,
      description: input.description ?? null,
      match_ratio: input.match_ratio,
      annual_cap_cents: input.annual_cap_cents,
      min_donation_cents: input.min_donation_cents,
      categories: input.categories.map((c) => c.trim()).filter(Boolean),
      currency: input.currency.toUpperCase(),
      status: input.status,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
