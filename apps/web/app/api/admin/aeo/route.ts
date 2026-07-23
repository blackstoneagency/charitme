import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isPublicRoute, normalizePublicRoute } from '../../../../lib/public-route-policy';
import { verifyAdmin } from '../users/_auth';

// Answer-Engine-Optimization Q&A entries stored in public.aeo_entries
// (RLS: service-role only). Published entries power the public AEO/FAQ surface.
const SCHEMA_TYPES = ['FAQPage', 'QAPage', 'HowTo'] as const;
const PUBLIC_ROUTE = z.string().trim().min(1).max(200).refine(isPublicRoute, 'Route must be a public path without query or hash parameters');

const AeoSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(3).max(300),
  answer: z.string().min(3).max(4000),
  topic: z.string().max(120).optional().nullable(),
  schemaType: z.enum(SCHEMA_TYPES).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  published: z.boolean().optional(),
  route: PUBLIC_ROUTE.optional(),
});

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('aeo_entries')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = AeoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const row = {
    question: d.question.trim(),
    answer: d.answer.trim(),
    topic: d.topic?.trim() || null,
    schema_type: d.schemaType ?? 'FAQPage',
    priority: d.priority ?? 0,
    published: d.published ?? true,
    route: normalizePublicRoute(d.route) ?? '/faq',
    updated_by: admin.id,
    updated_at: new Date().toISOString(),
  };

  const result = d.id
    ? await supabaseAdmin.from('aeo_entries').update(row).eq('id', d.id).select().single()
    : await supabaseAdmin.from('aeo_entries').insert(row).select().single();

  if (result.error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json(result.data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabaseAdmin.from('aeo_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
