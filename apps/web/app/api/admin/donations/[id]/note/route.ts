import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (!notes) return NextResponse.json({ error: 'Note content is required' }, { status: 400 });

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('donations')
    .update({ notes, updated_at: now })
    .eq('id', id)
    .select('id, notes')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('audit_logs')
    .insert({
      actor_id: admin.id,
      action: 'donation.note_added',
      target_type: 'donation',
      target_id: id,
      metadata: { notes },
      created_at: now,
    })
    .then(() => undefined);

  return NextResponse.json({ ok: true, donation: data });
}
