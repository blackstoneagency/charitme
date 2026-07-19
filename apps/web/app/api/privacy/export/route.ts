import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { assembleUserExport } from '../../../../lib/privacy';

// GET /api/privacy/export
// Immediate, self-serve data export of everything CharitMe holds about the user.
// Returns a downloadable JSON attachment and records a completed 'export' request.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bundle = await assembleUserExport(user.id);

  // Audit trail: record that an export was fulfilled (best-effort, non-blocking).
  await supabaseAdmin.from('privacy_requests').insert({
    user_id: user.id,
    type: 'export',
    status: 'completed',
    resolved_at: new Date().toISOString(),
    resolution_note: 'Self-serve export downloaded by the user.',
  });

  const filename = `charitme-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
