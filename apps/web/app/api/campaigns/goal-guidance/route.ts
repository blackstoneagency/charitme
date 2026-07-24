import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { buildGoalGuidance, type GuidanceRow } from '../../../../lib/goal-guidance';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

export const dynamic = 'force-dynamic';

// Suggested goal range for a category, derived from real comparable campaigns.
// Reads through the anon+cookies client so Postgres RLS decides what is visible —
// this only ever aggregates campaigns the public can already see.
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? '';
  if (!(CAMPAIGN_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('goal_amount, raised_amount')
      .eq('category', category)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
    return NextResponse.json({ guidance: buildGoalGuidance((data ?? []) as GuidanceRow[]) });
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
