import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '../users/_auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { normalizeEin, canTransitionVerification } from '../../../../lib/nonprofit-core';

const UpdateSchema = z.object({
  id: z.string().uuid(),
  verification_status: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
  tax_receipt_enabled: z.boolean().optional(),
  verified: z.boolean().optional(),
  // Server-side EIN format validation (CHAR-1001): reject anything that isn't a
  // valid US EIN, and store it in canonical XX-XXXXXXX form. Empty string clears.
  ein: z
    .string()
    .trim()
    .transform((v) => (v === '' ? '' : normalizeEin(v)))
    .refine((v) => v !== null, { message: 'Invalid EIN — expected a valid 9-digit US EIN (e.g. 12-3456789).' })
    .optional(),
  name: z.string().min(1).optional(),
  mission: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
});

// API routes must DENY, not redirect. `requireAdmin()` is the page helper: it
// calls redirect('/dashboard'), so a fetch caller received a 307 and then HTML,
// making res.json() throw — the UI showed a generic connection error instead of
// "your session expired". `verifyAdmin()` is the API-side equivalent and returns
// null. Same gate, correct protocol.
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ nonprofits: data ?? [], total: count ?? 0, page, limit });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id, ...updates } = parsed.data;

  // Guard the verification status machine (CHAR-1002): an admin cannot skip
  // review to jump straight to verified. Fetch the current status and validate
  // the transition before writing.
  if (updates.verification_status !== undefined) {
    const { data: current, error: readErr } = await supabaseAdmin
      .from('nonprofit_profiles')
      .select('verification_status')
      .eq('id', id)
      .single();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    const from = (current?.verification_status ?? 'unverified') as
      Parameters<typeof canTransitionVerification>[0];
    if (!canTransitionVerification(from, updates.verification_status)) {
      return NextResponse.json(
        { error: `Illegal verification transition: ${from} → ${updates.verification_status}.` },
        { status: 409 },
      );
    }
  }

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

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

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
