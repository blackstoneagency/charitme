import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const InviteSchema = z.object({
  email: z.string().trim().email().max(160),
});

async function adminAccountId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('corporate_accounts').select('id').eq('admin_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

// GET /api/corporate/members — members of the caller's administered account.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const corporateId = await adminAccountId(user.id);
  if (!corporateId) return NextResponse.json({ members: [] });

  const { data, error } = await supabaseAdmin
    .from('corporate_members')
    .select('id, email, role, status, created_at')
    .eq('corporate_id', corporateId)
    .neq('status', 'removed')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

// POST /api/corporate/members — invite an employee by email (admin only).
// If the email already belongs to a registered user, they're linked + activated.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const corporateId = await adminAccountId(user.id);
  if (!corporateId) return NextResponse.json({ error: 'You do not administer a corporate account', code: 'NO_ACCOUNT' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  // Link to an existing profile if one matches the email.
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();

  const { data: inserted, error } = await supabaseAdmin
    .from('corporate_members')
    .upsert(
      { corporate_id: corporateId, email, user_id: profile?.id ?? null, role: 'member', status: profile ? 'active' : 'invited' },
      { onConflict: 'corporate_id,email' },
    )
    .select('id, email, role, status')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: inserted }, { status: 201 });
}
