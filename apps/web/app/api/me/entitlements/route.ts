import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { getUserEntitlements } from '../../../../lib/entitlements';
import { PLAN_CATALOG } from '@shared/entitlements';

export const dynamic = 'force-dynamic';

// GET /api/me/entitlements
// Effective plan + feature access for the signed-in user. Unauthenticated
// callers get the free tier (so client gating has a safe default).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const entitlements = user ? await getUserEntitlements(user.id) : PLAN_CATALOG.free;
  return NextResponse.json({ entitlements });
}
