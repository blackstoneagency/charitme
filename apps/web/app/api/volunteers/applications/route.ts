import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/volunteers/applications — the signed-in user's volunteer applications.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('volunteer_applications')
    .select(
      'id, opportunity_id, status, hours_logged, hours_verified, applied_at, decided_at, ' +
      'volunteer_opportunities:opportunity_id(id, slug, title, org_name, is_remote, starts_at)',
    )
    .eq('applicant_user_id', user.id)
    .is('deleted_at', null)
    .order('applied_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}
