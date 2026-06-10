import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { canManageCampaign } from '../../../../../lib/auth';

const ITEM_TYPES = ['expense', 'milestone', 'receipt', 'payout', 'offline_donation', 'other'] as const;
const STATUSES = ['pending', 'received', 'paid', 'verified'] as const;

const CreateSchema = z.object({
  itemType: z.enum(ITEM_TYPES),
  title: z.string().trim().min(1).max(200),
  amountCents: z.number().int().min(0).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  status: z.enum(STATUSES).default('pending'),
});

async function authorize(campaignId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, title')
    .eq('id', campaignId)
    .single();

  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return { ok: false as const, status: 404, error: 'Campaign not found' };
  }
  return { ok: true as const, user, campaign: { id: campaign.id, title: campaign.title as string } };
}

// GET /api/campaigns/[id]/ledger — list transparency ledger items (owner or admin)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from('transparency_ledger_items')
    .select('id, item_type, title, amount_cents, category, status, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: auth.campaign, items: data ?? [] });
}

// POST /api/campaigns/[id]/ledger — add a ledger entry (owner or admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { itemType, title, amountCents, category, status } = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('transparency_ledger_items')
    .insert({
      campaign_id: id,
      item_type: itemType,
      title,
      amount_cents: amountCents ?? null,
      category: category || null,
      status,
    })
    .select('id, item_type, title, amount_cents, category, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

// DELETE /api/campaigns/[id]/ledger?itemId=... — remove a ledger entry (owner or admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const itemId = req.nextUrl.searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('transparency_ledger_items')
    .delete()
    .eq('id', itemId)
    .eq('campaign_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
