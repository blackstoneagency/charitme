import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  funderName: z.string().trim().min(2).max(200).optional(),
  funderType: z.enum(['foundation', 'government', 'corporate', 'community', 'individual', 'other']).optional(),
  summary: z.string().trim().max(1000).nullable().optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  focusAreas: z.array(z.string().trim().max(80)).max(25).optional(),
  eligibility: z.string().trim().max(5000).nullable().optional(),
  eligibleEntityTypes: z.array(z.string().trim().max(80)).max(25).optional(),
  amountMin: z.number().int().nonnegative().nullable().optional(),
  amountMax: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  applicationUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  deadlineAt: z.string().datetime().nullable().optional().or(z.literal('')),
  rollingDeadline: z.boolean().optional(),
  status: z.enum(['open', 'upcoming', 'closed']).optional(),
  verified: z.boolean().optional(),
});

const COL = {
  title: 'title', funderName: 'funder_name', funderType: 'funder_type', summary: 'summary',
  description: 'description', category: 'category', focusAreas: 'focus_areas', eligibility: 'eligibility',
  eligibleEntityTypes: 'eligible_entity_types', amountMin: 'amount_min', amountMax: 'amount_max',
  currency: 'currency', location: 'location', country: 'country', applicationUrl: 'application_url',
  deadlineAt: 'deadline_at', rollingDeadline: 'rolling_deadline', status: 'status', verified: 'verified',
} as const;

// PATCH /api/admin/grants/[id] — update grant fields (admin only).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(COL)) {
    const v = (parsed.data as Record<string, unknown>)[key];
    if (v !== undefined) patch[col] = v === '' ? null : v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }
  if (patch.amount_min != null && patch.amount_max != null && (patch.amount_min as number) > (patch.amount_max as number)) {
    return NextResponse.json({ error: 'Minimum award cannot exceed maximum' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('grants')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, status, verified, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
  return NextResponse.json({ grant: data });
}

// DELETE /api/admin/grants/[id] — soft-delete a grant (admin only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin
    .from('grants')
    .update({ deleted_at: new Date().toISOString(), status: 'closed' })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
