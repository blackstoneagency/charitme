import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireApiKey } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/me — who this key belongs to, and what it can do.
//
// The endpoint an integrator hits first to check their credential works. It
// returns the key's scopes so a client can fail early with a useful message
// instead of discovering a missing scope as a 403 halfway through a job.
//
// Returns the profile's display name and nothing more. Not the email: a key is
// often pasted into a third-party tool, and the scope is `profile:read` on a
// fundraising API, not an identity provider.

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request, 'profile:read');
  if (!auth.ok) return auth.response;

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('id', auth.ctx.ownerId)
    .maybeSingle();

  const profile = data as { id: string; full_name: string | null; created_at: string } | null;

  return NextResponse.json(
    {
      data: {
        id: auth.ctx.ownerId,
        name: profile?.full_name ?? null,
        member_since: profile?.created_at ?? null,
        scopes: auth.ctx.scopes,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
