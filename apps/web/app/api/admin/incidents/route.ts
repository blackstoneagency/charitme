import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, title, component, status, impact, started_at, resolved_at, created_by, created_at, updated_at';

const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;

const CreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  component: z.string().trim().min(1).max(60).default('platform'),
  impact: z.enum(['minor', 'major', 'critical']).default('minor'),
  status: z.enum(STATUSES).default('investigating'),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  impact: z.enum(['minor', 'major', 'critical']).optional(),
  /** Appended to the public timeline. */
  update: z.string().trim().min(3).max(2000).optional(),
});

// ── GET /api/admin/incidents ────────────────────────────────────────────────
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('incidents')
    .select(SELECT)
    .order('started_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: 'Could not load incidents', code: 'INCIDENTS_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json({ incidents: data ?? [] });
}

// ── POST /api/admin/incidents ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid incident', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('incidents')
    .insert({ ...parsed.data, created_by: admin.id })
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not open the incident', code: 'CREATE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ incident: data }, { status: 201 });
}

// ── PATCH /api/admin/incidents ──────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid update', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id, update, ...fields } = parsed.data;

  const patch: Record<string, unknown> = { ...fields };
  if (fields.status !== undefined) {
    // The DB refuses a resolved incident with no resolved_at, and an unresolved
    // one that carries one (incidents_resolved_consistency). Setting it here
    // keeps the API from generating rows the constraint will reject — the
    // constraint stays as the backstop, not as the mechanism.
    patch.resolved_at = fields.status === 'resolved' ? new Date().toISOString() : null;
  }

  const { data, error } = Object.keys(patch).length
    ? await supabaseAdmin.from('incidents').update(patch).eq('id', id).select(SELECT).single()
    : await supabaseAdmin.from('incidents').select(SELECT).eq('id', id).single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not update the incident', code: 'SAVE_FAILED' }, { status: 500 });
  }

  // The timeline entry is what the public page shows, so a failure here must be
  // reported: an admin who believes they posted an update would otherwise leave
  // users reading a stale one during an outage.
  if (update) {
    const { error: updErr } = await supabaseAdmin.from('incident_updates').insert({
      incident_id: id,
      body: update,
      status: (fields.status ?? (data as { status: string }).status),
      created_by: admin.id,
    });
    if (updErr) {
      return NextResponse.json(
        {
          incident: data,
          error: 'The incident was saved but your update was not posted. Post it again.',
          code: 'UPDATE_NOT_POSTED',
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ incident: data });
}
