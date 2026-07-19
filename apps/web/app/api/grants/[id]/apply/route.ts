import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { GrantApplicationCreateSchema } from '../../../../../lib/grants';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/grants/[id]/apply — start (or resume) an application for this grant.
// Idempotent: an existing non-terminal application for (grant, user) is returned
// rather than creating a duplicate.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Resolve grant by id or slug; must be a live grant.
  const grantQuery = supabaseAdmin
    .from('grants')
    .select('id, status')
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming']);
  const { data: grant } = await (UUID_RE.test(id)
    ? grantQuery.eq('id', id)
    : grantQuery.eq('slug', id)
  ).maybeSingle();
  if (!grant) return NextResponse.json({ error: 'Grant not found or not accepting applications' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = GrantApplicationCreateSchema.partial({ grantId: true }).safeParse({ ...body, grantId: grant.id });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Return an in-progress application if one already exists.
  const { data: existing } = await supabaseAdmin
    .from('grant_applications')
    .select('id, status')
    .eq('grant_id', grant.id)
    .eq('applicant_user_id', user.id)
    .is('deleted_at', null)
    .in('status', ['draft', 'submitted', 'under_review'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ application: existing, resumed: true });
  }

  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .insert({
      grant_id: grant.id,
      applicant_user_id: user.id,
      campaign_id: input.campaignId ?? null,
      organization_name: input.organizationName ?? null,
      amount_requested: input.amountRequested ?? null,
      narrative: input.narrative ?? null,
      answers: input.answers ?? {},
      status: 'draft',
    })
    .select('id, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data, resumed: false }, { status: 201 });
}
