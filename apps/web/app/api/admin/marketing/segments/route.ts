import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import { evaluateSegment } from '../../../../../lib/marketing-engine';

const ConditionSchema = z.object({
  field: z.string().max(40),
  op: z.enum(['eq', 'neq', 'gte', 'lte', 'has', 'not_has', 'contains']),
  value: z.union([z.string().max(200), z.number()]),
});

const SegmentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  rules: z.object({ logic: z.enum(['and', 'or']), conditions: z.array(ConditionSchema).max(20) }),
});

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('marketing_segments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ segments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = SegmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid segment' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('marketing_segments')
    .insert({ ...parsed.data, created_by: admin.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const { matched } = await evaluateSegment(data.id);
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'segment_created', entity: 'marketing_segments', entity_id: data.id,
    detail: { name: data.name, matched },
  });
  return NextResponse.json({ segment: { ...data, member_count: matched } });
}

// PATCH ?id=...&action=evaluate — re-run membership for a segment
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { matched } = await evaluateSegment(id);
  return NextResponse.json({ ok: true, matched });
}
