import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  ratio: z.number().min(0).max(10).optional(),
  perGiftCapCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  annualCapCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  active: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

/** Confirms the caller administers the account that owns this rule. */
async function ruleOwnedByAdmin(ruleId: string, userId: string): Promise<boolean> {
  const { data: rule } = await supabaseAdmin.from('matching_gift_rules').select('corporate_id').eq('id', ruleId).maybeSingle();
  if (!rule) return false;
  const { data: account } = await supabaseAdmin.from('corporate_accounts').select('admin_user_id').eq('id', rule.corporate_id).maybeSingle();
  return account?.admin_user_id === userId;
}

// PATCH /api/corporate/rules/:id — edit a rule (corporate admin only).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ruleOwnedByAdmin(id, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const update: Record<string, unknown> = {};
  if (d.ratio !== undefined) update.ratio = d.ratio;
  if (d.perGiftCapCents !== undefined) update.per_gift_cap_cents = d.perGiftCapCents;
  if (d.annualCapCents !== undefined) update.annual_cap_cents = d.annualCapCents;
  if (d.active !== undefined) update.active = d.active;

  const { data: updated, error } = await supabaseAdmin.from('matching_gift_rules').update(update).eq('id', id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: updated });
}

// DELETE /api/corporate/rules/:id — remove a rule (corporate admin only).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ruleOwnedByAdmin(id, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('matching_gift_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
