import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { userOwnsCampaign } from '../../../../lib/impact';
import { MetricCreateSchema } from '../../../../lib/impact-core';

export const dynamic = 'force-dynamic';

// POST /api/impact/metrics — add an outcome metric to a campaign (owner).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = MetricCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (!(await userOwnsCampaign(input.campaign_id, user.id))) {
    return NextResponse.json({ error: 'You do not own this campaign' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('impact_metrics')
    .insert({
      campaign_id: input.campaign_id,
      label: input.label,
      unit: input.unit ?? null,
      target_value: input.target_value ?? null,
      current_value: input.current_value,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
