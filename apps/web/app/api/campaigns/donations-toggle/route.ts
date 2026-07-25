import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const Schema = z.object({
  campaignId: z.string().uuid(),
  accept_donations: z.boolean(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { campaignId, accept_donations } = parsed.data;

  // Verify ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, title, status, accept_donations')
    .eq('id', campaignId)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Check admin
  const { data: profile } = await supabaseAdmin.from('profiles').select('roles').eq('id', user.id).single();
  const roles: string[] = Array.isArray((profile as { roles?: unknown })?.roles) ? (profile as { roles: string[] }).roles : [];
  const isAdmin = roles.includes('admin');

  if (campaign.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('campaigns')
    .update({ accept_donations, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .select('id, accept_donations')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    action: accept_donations ? 'campaign.donations_enabled' : 'campaign.donations_disabled',
    target_type: 'campaign',
    target_id: campaignId,
    metadata: { previous: campaign.accept_donations, new: accept_donations },
  });

  // Status log
  await supabaseAdmin.from('campaign_status_log').insert({
    campaign_id: campaignId,
    changed_by: user.id,
    from_status: campaign.status,
    to_status: campaign.status,
    reason: accept_donations ? 'Donations re-enabled' : 'Donations turned off',
    metadata: { accept_donations },
  });

  return NextResponse.json({ ok: true, campaign: updated });
}
