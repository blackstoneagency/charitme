import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { allowedPrivacyTransition, isPrivacyRequestStatus, type PrivacyRequestStatus } from '../../../../../lib/privacy';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'rejected', 'cancelled']),
  resolutionNote: z.string().trim().max(1000).optional(),
});

// PATCH /api/privacy/requests/:id — user cancels; admin fulfills.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const { data: reqRow } = await supabaseAdmin
    .from('privacy_requests')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!reqRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await isAdmin(user.id, user.email);
  const isOwner = reqRow.user_id === user.id;
  if (!admin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const from = isPrivacyRequestStatus(reqRow.status) ? reqRow.status : 'pending';
  const to = parsed.data.status as PrivacyRequestStatus;
  const actor: 'user' | 'admin' = admin ? 'admin' : 'user';
  if (from !== to && !allowedPrivacyTransition(actor, from, to)) {
    return NextResponse.json({ error: `${actor} cannot change status from ${from} to ${to}`, code: 'INVALID_TRANSITION' }, { status: 409 });
  }

  const update: Record<string, unknown> = { status: to };
  if (parsed.data.resolutionNote !== undefined && admin) update.resolution_note = parsed.data.resolutionNote;
  if (['completed', 'rejected', 'cancelled'].includes(to)) {
    update.resolved_at = new Date().toISOString();
    if (admin) update.resolver_id = user.id;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('privacy_requests')
    .update(update)
    .eq('id', id)
    .select('id, request_type, status, resolution_note, resolved_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    action: `privacy_request.${to}`,
    target_type: 'privacy_request',
    target_id: id,
    metadata: { actor, from, to },
  }).then(() => {}, () => {});

  return NextResponse.json({ request: updated });
}
