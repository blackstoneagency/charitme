import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { getAppOrigin } from '../../../../lib/auth-config';

export async function GET() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Best-effort sign out
  }
  return NextResponse.redirect(`${getAppOrigin()}/login`);
}
