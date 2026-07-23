import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { requireAdmin } from '../../../../../lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  // Sanitize allowed fields
  const allowed = ['name','flag_emoji','iso_code','can_fundraise','can_donate','currency_code','notes','active','sort_order'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }
  if ('iso_code' in patch && typeof patch.iso_code === 'string') {
    patch.iso_code = patch.iso_code.trim().toUpperCase();
  }
  if ('currency_code' in patch && typeof patch.currency_code === 'string') {
    patch.currency_code = patch.currency_code.trim().toUpperCase();
  }

  const { data, error } = await supabaseAdmin
    .from('supported_countries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ country: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await supabaseAdmin
    .from('supported_countries')
    .delete()
    .eq('id', id);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
