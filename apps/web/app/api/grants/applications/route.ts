import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/grants/applications — the signed-in user's grant applications with
// summary grant info, newest first.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .select(
      'id, grant_id, status, amount_requested, organization_name, submitted_at, decision_at, award_amount, created_at, updated_at, ' +
      'grants:grant_id(id, slug, title, funder_name, deadline_at, currency)',
    )
    .eq('applicant_user_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}
