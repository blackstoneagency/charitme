import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, title, description, component, starts_at, ends_at, status, created_by, created_at, updated_at';

const CreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    component: z.string().trim().min(1).max(60).default('platform'),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  // Checked here as well as by maintenance_time_order, so the operator gets a
  // usable message instead of a constraint-violation 500.
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'The window must end after it starts.',
    path: ['endsAt'],
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
});

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('maintenance_windows')
    .select(SELECT)
    .order('starts_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: 'Could not load maintenance windows', code: 'MAINTENANCE_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json({ windows: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid window', code: 'INVALID_INPUT' },
      { status: 400 },
    );
  }
  const v = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('maintenance_windows')
    .insert({
      title: v.title,
      description: v.description ?? null,
      component: v.component,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      created_by: admin.id,
    })
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not schedule the window', code: 'CREATE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ window: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid update', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('maintenance_windows')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not update the window', code: 'SAVE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ window: data });
}
