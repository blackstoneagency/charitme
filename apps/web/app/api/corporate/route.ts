import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { emailDomain } from '../../../lib/corporate';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  emailDomain: z.string().trim().max(120).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i).optional(),
  defaultMatchRatio: z.number().min(0).max(10).optional(),
  annualCapCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

// GET /api/corporate — the account the caller administers (or is a member of).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminAccount } = await supabaseAdmin
    .from('corporate_accounts')
    .select('id, name, email_domain, admin_user_id, default_match_ratio, annual_cap_cents, active, created_at')
    .eq('admin_user_id', user.id)
    .maybeSingle();

  if (adminAccount) return NextResponse.json({ account: adminAccount, role: 'admin' });

  // Otherwise, membership.
  const { data: membership } = await supabaseAdmin
    .from('corporate_members')
    .select('corporate_id, role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membership) {
    const { data: account } = await supabaseAdmin
      .from('corporate_accounts')
      .select('id, name, email_domain, default_match_ratio, annual_cap_cents, active')
      .eq('id', membership.corporate_id)
      .maybeSingle();
    return NextResponse.json({ account, role: membership.role });
  }

  return NextResponse.json({ account: null, role: null });
}

// POST /api/corporate — register a corporate account (caller becomes admin).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // One corporate account per admin (keeps the model simple).
  const { data: existing } = await supabaseAdmin.from('corporate_accounts').select('id').eq('admin_user_id', user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: 'You already administer a corporate account', code: 'ALREADY_EXISTS' }, { status: 409 });

  const domain = d.emailDomain ? d.emailDomain.toLowerCase() : emailDomain(user.email);

  const { data: inserted, error } = await supabaseAdmin
    .from('corporate_accounts')
    .insert({
      name: d.name,
      email_domain: domain,
      admin_user_id: user.id,
      default_match_ratio: d.defaultMatchRatio ?? 1,
      annual_cap_cents: d.annualCapCents ?? null,
    })
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That email domain is already registered', code: 'DOMAIN_TAKEN' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enroll the admin as an active member too.
  await supabaseAdmin.from('corporate_members').insert({
    corporate_id: inserted!.id, user_id: user.id, email: user.email ?? '', role: 'admin', status: 'active',
  }).then(() => {}, () => {});

  return NextResponse.json({ account: inserted, role: 'admin' }, { status: 201 });
}
