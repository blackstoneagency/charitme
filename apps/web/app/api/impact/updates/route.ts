import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { userOwnsCampaign } from '../../../../lib/impact';
import { UpdateCreateSchema } from '../../../../lib/impact-core';

export const dynamic = 'force-dynamic';

// POST /api/impact/updates — post a verified impact update (+ evidence) for a campaign.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = UpdateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (!(await userOwnsCampaign(input.campaign_id, user.id))) {
    return NextResponse.json({ error: 'You do not own this campaign' }, { status: 403 });
  }

  const { data: update, error } = await supabaseAdmin
    .from('impact_updates')
    .insert({
      campaign_id: input.campaign_id,
      author_id: user.id,
      title: input.title,
      body: input.body,
      amount_spent_cents: input.amount_spent_cents ?? null,
      status: input.status,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (input.evidence.length) {
    const rows = input.evidence.map((e) => ({
      update_id: update.id,
      kind: e.kind,
      url: e.url,
      caption: e.caption ?? null,
    }));
    const { error: evErr } = await supabaseAdmin.from('impact_evidence').insert(rows);
    if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: update.id }, { status: 201 });
}
