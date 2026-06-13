import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('id, name, logo_url, website')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ sponsors: [] });
  // Return sponsors that have either an uploaded logo OR a website (for favicon fallback)
  const withLogos = (data ?? []).filter((s: { logo_url: string | null; website: string | null }) =>
    s.logo_url?.startsWith('http') || s.website
  );
  return NextResponse.json({ sponsors: withLogos });
}
