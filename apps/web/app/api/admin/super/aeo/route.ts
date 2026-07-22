import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { isPublicRoute, normalizePublicRoute } from '../../../../../lib/public-route-policy';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';

const CreateSchema = z.object({
  question: z.string().trim().min(3).max(500),
  answer: z.string().trim().min(3).max(4000),
  topic: z.string().trim().max(120).optional().nullable(),
  schema_type: z.enum(['FAQPage', 'QAPage', 'HowTo']).default('FAQPage'),
  priority: z.number().int().min(0).max(1000).default(0),
  published: z.boolean().default(true),
  route: z.string().trim().min(1).max(200).refine(isPublicRoute, 'Route must be a public path without query or hash parameters').transform((value) => normalizePublicRoute(value) ?? '/faq').default('/faq'),
});
const UpdateSchema = CreateSchema.partial().extend({ id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('aeo_entries')
    .insert({ ...parsed.data, updated_by: guard.user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'aeo.create', 'aeo_entries', data.id, {});
  return NextResponse.json({ ok: true, row: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { id, ...patch } = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('aeo_entries')
    .update({ ...patch, updated_by: guard.user.id })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'aeo.update', 'aeo_entries', id, {});
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabaseAdmin.from('aeo_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'aeo.delete', 'aeo_entries', id, {});
  return NextResponse.json({ ok: true });
}
