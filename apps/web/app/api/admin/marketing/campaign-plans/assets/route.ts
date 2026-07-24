import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';

export const dynamic = 'force-dynamic';

// PATCH ?id= → edit an asset's title/body or change its status (draft|approved|archived).
const PatchInput = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20_000).optional(),
  status: z.enum(['draft', 'approved', 'archived']).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const parsed = PatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update', issues: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('marketing_campaign_plan_assets').update(parsed.data).eq('id', id).select('*').single();
  if (error || !data) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'campaign_asset_updated', entity: 'marketing_campaign_plan_assets', entity_id: id,
    detail: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ asset: data });
}
