import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { attachCampaignCurrencies } from '../../../lib/home-data';

const ToggleSchema = z.object({
  campaignId: z.string().uuid(),
});

// GET /api/saved-campaigns
// Returns the signed-in user's saved campaigns with summary campaign info.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: saved, error } = await supabaseAdmin
    .from('saved_campaigns')
    .select('campaign_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const campaignIds = (saved ?? []).map((s) => s.campaign_id as string);
  if (campaignIds.length === 0) return NextResponse.json({ campaigns: [] });

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, category, cover_image_url, goal_amount, raised_amount, backer_count, status')
    .in('id', campaignIds)
    .neq('visibility', 'private')
    .is('deleted_at', null);

  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id as string, c]));
  const ordered = campaignIds
    .map((id) => campaignMap.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  return NextResponse.json({ campaigns: await attachCampaignCurrencies(ordered) });
}

// POST /api/saved-campaigns { campaignId }
// Toggles the save state for a campaign and returns { saved: boolean }.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { campaignId } = parsed.data;

  const { data: existing } = await supabaseAdmin
    .from('saved_campaigns')
    .select('id')
    .eq('user_id', user.id)
    .eq('campaign_id', campaignId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin.from('saved_campaigns').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    return NextResponse.json({ saved: false });
  }

  const { error } = await supabaseAdmin
    .from('saved_campaigns')
    .insert({ user_id: user.id, campaign_id: campaignId });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ saved: true });
}
