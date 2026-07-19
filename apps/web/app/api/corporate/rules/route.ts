import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  category: z.string().trim().max(80).nullable().optional(),
  ratio: z.number().min(0).max(10),
  perGiftCapCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  annualCapCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

/** Returns the corporate account the caller administers, or null. */
async function adminAccountId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('corporate_accounts').select('id').eq('admin_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

// GET /api/corporate/rules — rules for the caller's administered account.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const corporateId = await adminAccountId(user.id);
  if (!corporateId) return NextResponse.json({ rules: [] });

  const { data, error } = await supabaseAdmin
    .from('matching_gift_rules')
    .select('id, category, ratio, per_gift_cap_cents, annual_cap_cents, active, created_at')
    .eq('corporate_id', corporateId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

// POST /api/corporate/rules — add a matching-gift rule (corporate admin only).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const corporateId = await adminAccountId(user.id);
  if (!corporateId) return NextResponse.json({ error: 'You do not administer a corporate account', code: 'NO_ACCOUNT' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const { data: inserted, error } = await supabaseAdmin
    .from('matching_gift_rules')
    .insert({
      corporate_id: corporateId,
      category: d.category ?? null,
      ratio: d.ratio,
      per_gift_cap_cents: d.perGiftCapCents ?? null,
      annual_cap_cents: d.annualCapCents ?? null,
    })
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: inserted }, { status: 201 });
}
