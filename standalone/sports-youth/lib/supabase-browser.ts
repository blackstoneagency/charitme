'use client';
import { createBrowserClient } from '@supabase/ssr';

/** Anon-key client for Client Components. RLS applies. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
