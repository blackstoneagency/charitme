import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ensureUserProfile } from '../../../../lib/profile-sync';
import { checkRateLimit } from '../../../../lib/rate-limit';

type SyncProfileResponse = {
  ok: boolean;
  error?: string;
  code?: string;
};

const bearerTokenSchema = z.string().min(1);

function json(body: SyncProfileResponse, status: number): NextResponse<SyncProfileResponse> {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse<SyncProfileResponse>> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!checkRateLimit(`sync-profile:${ip}`, 10, 60_000)) {
    return json({ ok: false, error: 'Too many requests', code: 'RATE_LIMITED' }, 429);
  }

  const authorization = request.headers.get('authorization');
  const tokenResult = bearerTokenSchema.safeParse(
    authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '',
  );

  if (!tokenResult.success) {
    return json({ ok: false, error: 'Authentication required', code: 'UNAUTHORIZED' }, 401);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser(tokenResult.data);

  if (userError || !user) {
    return json({ ok: false, error: 'Authentication required', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    await ensureUserProfile(user);
  } catch {
    return json({ ok: false, error: 'Could not sync profile', code: 'PROFILE_SYNC_FAILED' }, 500);
  }

  return json({ ok: true }, 200);
}
