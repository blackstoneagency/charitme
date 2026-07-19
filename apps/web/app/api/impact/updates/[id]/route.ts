import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { userOwnsCampaign } from '../../../../../lib/impact';
import { UpdatePatchSchema } from '../../../../../lib/impact-core';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/impact/updates/:id — edit / publish an impact update (owner).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: upd } = await supabaseAdmin
    .from('impact_updates')
    .select('campaign_id')
    .eq('id', id)
    .maybeSingle();
  if (!upd) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await userOwnsCampaign(upd.campaign_id, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdatePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) patch[k] = v;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('impact_updates').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
