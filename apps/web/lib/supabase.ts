import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createSupabaseAdminClient() {
  return createClient(
    supabaseUrl as string,
    serviceRoleKey as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

function missingSupabaseEnv(): never {
  const missing = [
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
  ].filter(Boolean).join(', ');

  throw new Error(`${missing} ${missing.includes(',') ? 'are' : 'is'} not set`);
}

export const supabaseAdmin: SupabaseAdminClient = supabaseUrl && serviceRoleKey
  ? createSupabaseAdminClient()
  : new Proxy({} as SupabaseAdminClient, {
    get() {
      return missingSupabaseEnv();
    },
  });
