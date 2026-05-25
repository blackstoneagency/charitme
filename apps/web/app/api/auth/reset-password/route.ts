import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { getAppOrigin } from '../../../../lib/auth-config';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${getAppOrigin()}/api/auth/callback?next=/profile`,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
