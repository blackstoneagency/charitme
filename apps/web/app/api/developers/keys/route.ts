import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { generateApiKey, keyFingerprint, isApiScope, API_SCOPES } from '../../../../lib/api-keys';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// API key management. Session-authenticated (a person in a browser), unlike
// `/api/v1/*` which is key-authenticated.
//
// ⚠️ The plaintext key is returned by POST and NEVER again — there is no
// endpoint that can reveal it, because only the hash is stored. Losing it means
// creating a new one, which is the correct trade.
//
// Revocation is a soft `revoked_at` stamp rather than a DELETE: a key that
// appeared in logs or an incident needs to stay auditable after being turned
// off. `requireApiKey` filters on it and re-checks it.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_KEYS_PER_USER = 10;

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  scopes: z
    .array(z.string())
    .min(1, 'Choose at least one scope.')
    .max(API_SCOPES.length)
    .refine((s) => s.every(isApiScope), 'Unknown scope.'),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // `key_hash` is never selected. It cannot reconstruct the key, but there is no
  // reason for it to travel to a browser.
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, name, scopes, last_used_at, revoked_at, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ keys: data ?? [], availableScopes: API_SCOPES });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`api-key-create:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many keys created. Try again later.', code: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  // Counting ACTIVE keys only — revoked ones stay for the audit trail and must
  // not consume the allowance forever.
  const { count } = await supabaseAdmin
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .is('revoked_at', null);

  if ((count ?? 0) >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `You can have ${MAX_KEYS_PER_USER} active keys. Revoke one first.`, code: 'LIMIT_REACHED' },
      { status: 409 },
    );
  }

  const { key, hash } = generateApiKey();

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      key_hash: hash,
      scopes: parsed.data.scopes,
    })
    .select('id, name, scopes, last_used_at, revoked_at, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json(
    {
      key: data,
      // The only time this value exists outside the client's own storage.
      plaintext: key,
      fingerprint: keyFingerprint(key),
      warning: 'Copy this key now. It cannot be shown again.',
    },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Ownership is a filter inside the UPDATE, so someone else's key matches no
  // row rather than being revoked by a guessed id.
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
