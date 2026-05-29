import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

const CreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(1000).optional(),
  targetAmount: z.number().int().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// GET /api/campaigns/[id]/milestones
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('campaign_milestones')
    .select('id, title, description, target_amount, reached_at, sort_order, created_at')
    .eq('campaign_id', id)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestones: data ?? [] });
}

// POST /api/campaigns/[id]/milestones
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership
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

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { title, description, targetAmount, sortOrder } = parsed.data;

  const { data: milestone, error } = await supabaseAdmin
    .from('campaign_milestones')
    .insert({
      campaign_id: id,
      title,
      description: description ?? null,
      target_amount: targetAmount ?? null,
      sort_order: sortOrder ?? 0,
    })
    .select('id, title, description, target_amount, reached_at, sort_order, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestone }, { status: 201 });
}
