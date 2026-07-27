import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

const SponsorSchema = z.object({
  name:     z.string().min(1).max(120),
  logo_url: z.string().url().optional().nullable(),
  website:  z.string().url().optional().nullable(),
  active:   z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

// Admin-only, like every other method here.
//
// This GET had NO auth check while POST/PATCH/DELETE all call verifyAdmin(), and
// it reads through `supabaseAdmin` (service role, RLS bypassed). Measured against
// the live database: it returned all 50 sponsor rows to an anonymous caller —
// including the **10 with `active: false`**, which the public /api/sponsors
// deliberately withholds (it returns 40). Deactivated or draft sponsor records
// are unpublished commercial relationships, so that is a real disclosure.
//
// Why no existing check caught it: __tests__/api-auth-coverage.test.ts scans the
// FILE for a guard and this file has one (in POST), and e2e/auth-gates.spec.ts
// only probes two hardcoded endpoints. "Contains a guard" and "denies access" are
// different claims. Found by scripts/audit-api-auth-live.mjs.
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ sponsors: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = SponsorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .insert({ ...parsed.data, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ sponsor: data });
}
