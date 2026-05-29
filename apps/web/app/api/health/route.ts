import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export async function GET() {
  const checks: Record<string, unknown> = {
    ts: Date.now(),
    status: 'ok',
  };

  // Check Supabase connectivity and key table counts
  try {
    const [
      { count: profileCount,  error: e1 },
      { count: campaignCount, error: e2 },
      { count: donationCount, error: e3 },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*',  { count: 'exact', head: true }),
      supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }),
    ]);

    checks.supabase = 'connected';
    checks.profiles  = e1 ? `error: ${e1.message}` : profileCount;
    checks.campaigns = e2 ? `error: ${e2.message}` : campaignCount;
    checks.donations = e3 ? `error: ${e3.message}` : donationCount;
    checks.env = {
      url:            process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
      anonKey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'MISSING',
      stripeKey:      process.env.STRIPE_SECRET_KEY ? 'set' : 'MISSING',
      openaiKey:      process.env.OPENAI_API_KEY ? 'set' : 'not set (optional)',
      resendKey:      process.env.RESEND_API_KEY ? 'set' : 'not set (optional)',
      appUrl:         process.env.NEXT_PUBLIC_APP_URL ?? 'not set (using fallback)',
    };
  } catch (err) {
    checks.supabase = `error: ${err instanceof Error ? err.message : String(err)}`;
    checks.env = {
      url:            process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
    };
  }

  const isHealthy = checks.supabase === 'connected';
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}
