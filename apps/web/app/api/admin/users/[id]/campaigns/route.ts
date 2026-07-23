import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../_auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, status, raised_amount, goal_amount, backer_count, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  type CampaignRow = {
    id: string;
    title: string;
    status: string;
    raised_amount: number;
    goal_amount: number;
    backer_count: number;
    created_at: string;
  };

  const campaigns = (data ?? []).map((row: CampaignRow) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    raisedAmount: row.raised_amount,
    goalAmount: row.goal_amount,
    backerCount: row.backer_count,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ campaigns });
}
