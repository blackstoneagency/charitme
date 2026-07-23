import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('donations')
    .update({ receipt_sent_at: now, updated_at: now })
    .eq('id', id)
    .select('id, receipt_sent_at')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  await supabaseAdmin
    .from('audit_logs')
    .insert({
      actor_id: admin.id,
      action: 'donation.receipt_sent',
      target_type: 'donation',
      target_id: id,
      metadata: {},
      created_at: now,
    })
    .then(() => undefined);

  return NextResponse.json({ ok: true, donation: data });
}
