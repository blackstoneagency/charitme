import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

// API routes must DENY, not redirect. `requireAdmin()` is the page helper: it
// calls redirect('/dashboard'), so a fetch caller received a 307 and then HTML,
// making res.json() throw — the UI showed a generic connection error instead of
// "your session expired". `verifyAdmin()` is the API-side equivalent and returns
// null. Same gate, correct protocol.
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('supported_countries')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ countries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as {
    name?: string;
    flag_emoji?: string;
    iso_code?: string;
    can_fundraise?: boolean;
    can_donate?: boolean;
    currency_code?: string;
    notes?: string;
    active?: boolean;
    sort_order?: number;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('supported_countries')
    .insert({
      name:          body.name.trim(),
      flag_emoji:    body.flag_emoji?.trim() ?? '',
      iso_code:      body.iso_code?.trim().toUpperCase() ?? '',
      can_fundraise: body.can_fundraise ?? false,
      can_donate:    body.can_donate ?? true,
      currency_code: body.currency_code?.trim().toUpperCase() ?? 'USD',
      notes:         body.notes?.trim() || null,
      active:        body.active ?? true,
      sort_order:    body.sort_order ?? 999,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ country: data }, { status: 201 });
}
