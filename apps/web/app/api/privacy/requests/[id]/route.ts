import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { anonymizeUserProfile } from '../../../../../lib/privacy';
import {
  RequestUpdateSchema,
  canTransitionRequest,
  isTerminal,
  type PrivacyActor,
  type PrivacyRequestStatus,
} from '../../../../../lib/privacy-core';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/privacy/requests/:id
// User: cancel. Admin: mark in_progress / completed / rejected (deletion =>
// completing scrubs profile PII while retaining transaction records).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: pr } = await supabaseAdmin
    .from('privacy_requests')
    .select('id, user_id, type, status')
    .eq('id', id)
    .maybeSingle();
  if (!pr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await isAdmin(user.id, user.email);
  const isOwner = pr.user_id === user.id;
  if (!admin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const actor: PrivacyActor = admin ? 'admin' : 'user';

  const body = await request.json().catch(() => null);
  const parsed = RequestUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { status, resolution_note } = parsed.data;

  if (!canTransitionRequest(actor, pr.status as PrivacyRequestStatus, status)) {
    return NextResponse.json(
      { error: `A ${actor} cannot move this request from ${pr.status} to ${status}` },
      { status: 409 },
    );
  }

  // Completing a deletion request performs the actual PII anonymization.
  if (admin && pr.type === 'deletion' && status === 'completed') {
    const ok = await anonymizeUserProfile(pr.user_id);
    if (!ok) {
      return NextResponse.json({ error: 'Failed to anonymize profile; request left unchanged' }, { status: 500 });
    }
  }

  const patch: Record<string, unknown> = { status };
  if (resolution_note !== undefined) patch.resolution_note = resolution_note;
  if (isTerminal(status)) {
    patch.resolved_at = new Date().toISOString();
    if (admin) patch.resolver_id = user.id;
  }

  const { error } = await supabaseAdmin.from('privacy_requests').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
