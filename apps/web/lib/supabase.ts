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


/**
 * Anon-key client for reads of data that is ALREADY PUBLIC.
 *
 * ⚠️ Added during a live outage: the `sb_secret_` service-role key was revoked
 * in the Supabase dashboard, so every `supabaseAdmin` read failed and the whole
 * site rendered em dashes. The anon key was unaffected and returns 352
 * campaigns — the same number the healthy site reported — because RLS grants
 * public SELECT on live campaigns.
 *
 * ⚠️⚠️ USE THIS ONLY WHERE ANON SEES THE SAME ROWS AS SERVICE ROLE.
 * It is NOT a general fallback. `donations` returns 0 under anon (RLS hides
 * them) while the true figure is 592 — so routing a COUNT through here would
 * publish "0 gifts given" on a donation platform. An em dash means "we could
 * not measure"; a zero means "nobody ever gave". Never trade the first for the
 * second.
 *
 * Safe: public campaign listings, volunteer opportunities, supported countries.
 * Unsafe: anything counting donations, or any owner-scoped or private data.
 */
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabasePublic: SupabaseAdminClient = supabaseUrl && anonKey
  ? createClient(supabaseUrl as string, anonKey as string, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabaseAdmin;
