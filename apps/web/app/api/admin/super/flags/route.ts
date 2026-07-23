import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';

const CreateSchema = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/, 'lowercase, digits, underscore only'),
  description: z.string().trim().max(300).optional().nullable(),
  enabled: z.boolean().default(false),
  rollout_pct: z.number().int().min(0).max(100).default(100),
});
const UpdateSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  rollout_pct: z.number().int().min(0).max(100).optional(),
  description: z.string().trim().max(300).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('feature_flags')
    .insert({ ...parsed.data, updated_by: guard.user.id })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A flag with that key already exists.' }, { status: 409 });
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
  await logSuperAdminAction(guard.user.id, 'flag.create', 'feature_flags', data.id, { key: parsed.data.key });
  return NextResponse.json({ ok: true, row: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { id, ...patch } = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('feature_flags')
    .update({ ...patch, updated_by: guard.user.id })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'flag.update', 'feature_flags', id, patch);
  return NextResponse.json({ ok: true, row: data });
}
