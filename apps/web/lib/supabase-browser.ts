import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      auth: {
        // Explicitly declare PKCE so the code-verifier is always stored in a
        // cookie (not localStorage).  @supabase/ssr should default to this,
        // but being explicit prevents edge-cases with certain bundle versions
        // where the default resolves to the legacy 'implicit' flow.
        flowType: 'pkce',
      },
    }
  );
}
