import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

const defaultSettings = {
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
  brandPrimaryColor: '#6c35ff',
  brandAccentColor: '#ec3fb4',
  logoUrl: '',
  emailFromName: 'KindFund',
  emailFromAddress: 'support@kindfund.com',
  donationFeePercent: 2.9,
  platformFeePercent: 5,
  stripeLiveMode: true,
  notifyAdminOnDonation: true,
  notifyCampaignApproval: true,
  requireMfaForAdmins: false,
  sessionTimeoutMinutes: 60,
  googleOAuthEnabled: true,
  stripeConnectEnabled: true,
  maxUploadMb: 10,
  auditRetentionDays: 365,
};

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();

  if (error && error.code !== '42P01') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const config = data?.config && typeof data.config === 'object' ? data.config : {};
  return NextResponse.json({ ...defaultSettings, ...config });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid settings body' }, { status: 400 });
  }

  const config = { ...defaultSettings, ...(body as Record<string, unknown>) };
  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert({
      id: 1,
      config,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: config });
}
