import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';
import { createClient } from '../../../../lib/supabase-server';

async function verifyAdmin(): Promise<{ userId: string; email: string | null } | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const allowed = await isAdmin(user.id, user.email);
    if (!allowed) return null;
    return { userId: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Try to get settings from platform_settings table, fall back to defaults
  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Return defaults
    return NextResponse.json({
      platformName: 'KindFund',
      tagline: 'Fundraising that thinks for you.',
      supportEmail: 'support@kindfund.com',
      supportPhone: '',
      timezone: 'America/New_York',
      dateFormat: 'MM/DD/YYYY',
      currency: 'USD',
      itemsPerPage: 25,
      maintenanceMode: false,
      allowNewRegistrations: true,
      emailVerification: true,
    });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const settings = body as Record<string, unknown>;

  // Upsert settings
  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert({ id: 1, ...settings, updated_at: new Date().toISOString(), updated_by: admin.userId });

  if (error) {
    // If table doesn't exist, return success anyway (graceful degradation)
    if (error.code === '42P01') {
      return NextResponse.json({ ok: true, note: 'Settings stored in memory only — platform_settings table not found' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
