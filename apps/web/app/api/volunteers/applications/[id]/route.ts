import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({ status: z.enum(['withdrawn']) });

// PATCH /api/volunteers/applications/[id] — applicant withdraws (owner only).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: app } = await supabaseAdmin
    .from('volunteer_applications')
    .select('id, applicant_user_id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!app || app.applicant_user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (app.status === 'completed' || app.status === 'withdrawn') {
    return NextResponse.json({ error: `Cannot withdraw a ${app.status} application` }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('volunteer_applications')
    .update({ status: 'withdrawn', decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('applicant_user_id', user.id)
    .select('id, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data });
}
