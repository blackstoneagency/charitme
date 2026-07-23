import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  orgName: z.string().trim().min(2).max(200).optional(),
  summary: z.string().trim().max(1000).nullable().optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  skills: z.array(z.string().trim().max(80)).max(40).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  isRemote: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional().or(z.literal('')),
  endsAt: z.string().datetime().nullable().optional().or(z.literal('')),
  slots: z.number().int().nonnegative().max(100_000).nullable().optional(),
  timeCommitment: z.string().trim().max(120).nullable().optional(),
  contactUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  status: z.enum(['open', 'upcoming', 'closed']).optional(),
  verified: z.boolean().optional(),
});

const COL = {
  title: 'title', orgName: 'org_name', summary: 'summary', description: 'description',
  category: 'category', skills: 'skills', location: 'location', country: 'country',
  isRemote: 'is_remote', startsAt: 'starts_at', endsAt: 'ends_at', slots: 'slots',
  timeCommitment: 'time_commitment', contactUrl: 'contact_url', status: 'status', verified: 'verified',
} as const;

// PATCH /api/admin/volunteers/[id] — update an opportunity (admin only).
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
  if (patch.starts_at && patch.ends_at && new Date(patch.starts_at as string) > new Date(patch.ends_at as string)) {
    return NextResponse.json({ error: 'Start date cannot be after end date' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('volunteer_opportunities')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, status, verified, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  return NextResponse.json({ opportunity: data });
}

// DELETE /api/admin/volunteers/[id] — soft-delete (admin only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin
    .from('volunteer_opportunities')
    .update({ deleted_at: new Date().toISOString(), status: 'closed' })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
