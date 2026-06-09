import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

const UpdateSchema = z.object({
  id: z.string().uuid(),
  verification_status: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
  tax_receipt_enabled: z.boolean().optional(),
  verified: z.boolean().optional(),
  ein: z.string().optional(),
  name: z.string().min(1).optional(),
  mission: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
});

export async function GET(request: NextRequest) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

  let query = supabaseAdmin
    .from('nonprofit_profiles')
    .select('*, profiles:owner_id(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('verification_status', status);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ nonprofits: data ?? [], total: count ?? 0, page, limit });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id, ...updates } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('nonprofit_profiles')
    .update({
      ...updates,
      ...(updates.verified !== undefined && updates.verified ? { verified_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'nonprofit.updated',
    target_type: 'nonprofit',
    target_id: id,
    metadata: updates,
  });

  return NextResponse.json({ nonprofit: data });
}
