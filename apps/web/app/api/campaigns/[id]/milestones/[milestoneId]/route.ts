import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';

const UpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  targetAmount: z.number().int().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  reachedAt: z.string().nullable().optional(), // ISO timestamp or null to un-mark
});

// PATCH /api/campaigns/[id]/milestones/[milestoneId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, milestoneId } = await params;

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
  if (parsed.data.targetAmount !== undefined) updates.target_amount = parsed.data.targetAmount;
  if (parsed.data.sortOrder !== undefined) updates.sort_order = parsed.data.sortOrder;
  if (parsed.data.reachedAt !== undefined) updates.reached_at = parsed.data.reachedAt;

  const { data, error } = await supabaseAdmin
    .from('campaign_milestones')
    .update(updates)
    .eq('id', milestoneId)
    .eq('campaign_id', id)
    .select('id, title, description, target_amount, reached_at, sort_order, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestone: data });
}

// DELETE /api/campaigns/[id]/milestones/[milestoneId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, milestoneId } = await params;

  // Verify ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('campaign_milestones')
    .delete()
    .eq('id', milestoneId)
    .eq('campaign_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
