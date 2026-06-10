import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';
import { MIN_DONATION_CENTS, MAX_DONATION_CENTS } from '@shared/fees';

const UpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  amountCents: z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS).optional(),
  estimatedDelivery: z.string().trim().max(100).nullable().optional(),
  itemLimit: z.number().int().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// PATCH /api/campaigns/[id]/rewards/[rewardId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rewardId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, rewardId } = await params;

  // Verify ownership via campaign
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.amountCents !== undefined) updates.amount_cents = parsed.data.amountCents;
  if (parsed.data.estimatedDelivery !== undefined) updates.estimated_delivery = parsed.data.estimatedDelivery;
  if (parsed.data.itemLimit !== undefined) updates.item_limit = parsed.data.itemLimit;
  if (parsed.data.sortOrder !== undefined) updates.sort_order = parsed.data.sortOrder;

  const { data, error } = await supabaseAdmin
    .from('campaign_rewards')
    .update(updates)
    .eq('id', rewardId)
    .eq('campaign_id', id)
    .select('id, title, description, amount_cents, estimated_delivery, item_limit, claimed_count, sort_order, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reward: data });
}

// DELETE /api/campaigns/[id]/rewards/[rewardId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rewardId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, rewardId } = await params;

  // Verify ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('campaign_rewards')
    .delete()
    .eq('id', rewardId)
    .eq('campaign_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
