import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { MIN_DONATION_CENTS, MAX_DONATION_CENTS } from '@shared/fees';

const CreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(1000).optional(),
  amountCents: z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS),
  estimatedDelivery: z.string().trim().max(100).optional(),
  itemLimit: z.number().int().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// GET /api/campaigns/[id]/rewards
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [{ data, error }, { data: launchSettings }] = await Promise.all([
    supabaseAdmin
      .from('campaign_rewards')
      .select('id, title, description, amount_cents, estimated_delivery, item_limit, claimed_count, sort_order, created_at')
      .eq('campaign_id', id)
      .order('sort_order', { ascending: true })
      .order('amount_cents', { ascending: true }),
    supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', id)
      .maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rewards: data ?? [], currency: launchSettings?.currency ?? 'usd' });
}

// POST /api/campaigns/[id]/rewards
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

  const { title, description, amountCents, estimatedDelivery, itemLimit, sortOrder } = parsed.data;

  const { data: reward, error } = await supabaseAdmin
    .from('campaign_rewards')
    .insert({
      campaign_id: id,
      title,
      description: description ?? null,
      amount_cents: amountCents,
      estimated_delivery: estimatedDelivery ?? null,
      item_limit: itemLimit ?? null,
      sort_order: sortOrder ?? 0,
    })
    .select('id, title, description, amount_cents, estimated_delivery, item_limit, claimed_count, sort_order, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reward }, { status: 201 });
}
