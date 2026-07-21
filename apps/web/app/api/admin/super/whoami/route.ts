import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase-server';
import { isSuperAdmin } from '../../../../../lib/roles';

// GET /api/admin/super/whoami — lightweight gate check for the sidebar dropdown.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ superAdmin: false });
  const superAdmin = await isSuperAdmin(user.id, user.email);
  return NextResponse.json({ superAdmin });
}
