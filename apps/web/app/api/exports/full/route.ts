import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/exports/full
// Returns a full JSON export of the authenticated user's data.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [
    { data: profile },
    { data: campaigns },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,bio,plan,created_at').eq('id', user.id).single(),
    supabaseAdmin.from('campaigns').select('id,title,slug,status,raised_amount,goal_amount,backer_count,category,created_at').eq('user_id', user.id),
  ]);

  const cids = (campaigns ?? []).map((c: { id: string }) => c.id);

  const [
    { data: donations },
    { data: updates },
    { data: teamMembers },
  ] = await Promise.all([
    cids.length > 0
      ? supabaseAdmin.from('donations').select('id,campaign_id,donor_name,amount_cents,status,created_at').in('campaign_id', cids)
      : Promise.resolve({ data: [] }),
    cids.length > 0
      ? supabaseAdmin.from('campaign_updates').select('id,campaign_id,title,body,created_at').in('campaign_id', cids)
      : Promise.resolve({ data: [] }),
    cids.length > 0
      ? supabaseAdmin.from('team_members').select('id,campaign_id,user_id,role,created_at').in('campaign_id', cids)
      : Promise.resolve({ data: [] }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    profile,
    campaigns: campaigns ?? [],
    donations: donations ?? [],
    campaign_updates: updates ?? [],
    team_members: teamMembers ?? [],
  };

  const body = JSON.stringify(exportData, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="full-export-${Date.now()}.json"`,
    },
  });
}
