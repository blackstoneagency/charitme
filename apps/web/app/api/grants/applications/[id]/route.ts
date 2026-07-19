import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { GrantApplicationUpdateSchema } from '../../../../../lib/grants';

export const dynamic = 'force-dynamic';

async function loadOwnedApplication(applicationId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('grant_applications')
    .select('id, applicant_user_id, status')
    .eq('id', applicationId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data || data.applicant_user_id !== userId) return null;
  return data;
}

// GET /api/grants/applications/[id] — full application detail (owner only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .select('*, grants:grant_id(id, slug, title, funder_name, deadline_at, application_url, currency)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.applicant_user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ application: data });
}

// PATCH /api/grants/applications/[id] — edit a draft or submit/withdraw (owner only).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const app = await loadOwnedApplication(id, user.id);
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = GrantApplicationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Guard status transitions: only draft→submitted and (draft|submitted)→withdrawn.
  const patch: Record<string, unknown> = {};
  if (input.status && input.status !== app.status) {
    const allowed =
      (app.status === 'draft' && input.status === 'submitted') ||
      ((app.status === 'draft' || app.status === 'submitted') && input.status === 'withdrawn');
    if (!allowed) {
      return NextResponse.json({ error: `Cannot change status from ${app.status} to ${input.status}` }, { status: 409 });
    }
    patch.status = input.status;
    if (input.status === 'submitted') patch.submitted_at = new Date().toISOString();
  }

  // Content edits are only permitted while still a draft.
  if (app.status === 'draft') {
    if (input.organizationName !== undefined) patch.organization_name = input.organizationName;
    if (input.amountRequested !== undefined) patch.amount_requested = input.amountRequested;
    if (input.narrative !== undefined) patch.narrative = input.narrative;
    if (input.answers !== undefined) patch.answers = input.answers;
  } else if (
    input.organizationName !== undefined || input.amountRequested !== undefined ||
    input.narrative !== undefined || input.answers !== undefined
  ) {
    return NextResponse.json({ error: 'Application can only be edited while in draft' }, { status: 409 });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .update(patch)
    .eq('id', id)
    .eq('applicant_user_id', user.id)
    .select('id, status, submitted_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data });
}

// DELETE /api/grants/applications/[id] — soft-delete a draft (owner only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const app = await loadOwnedApplication(id, user.id);
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (app.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft applications can be deleted; withdraw instead' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('grant_applications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('applicant_user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
