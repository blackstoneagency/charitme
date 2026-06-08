import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../users/_auth';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('risk_flags')
    .update({ resolved: true, resolved_by: admin.id, resolved_at: now })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'risk_flag.resolved',
    target_type: 'risk_flag',
    target_id: id,
    metadata: {},
    created_at: now,
  });

  return NextResponse.redirect(new URL('/admin/trust-safety', process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com'));
}
