import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

// GET /api/health — connectivity + table counts
export async function GET() {
  const checks: Record<string, unknown> = { ts: Date.now(), status: 'ok' };

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

    checks.supabase  = 'connected';
    checks.profiles  = e1 ? `error: ${e1.code ?? ''} ${e1.message ?? ''}`.trim() : profileCount;
    checks.campaigns = e2 ? `error: ${e2.code ?? ''} ${e2.message ?? ''}`.trim() : campaignCount;
    checks.donations = e3 ? `error: ${e3.code ?? ''} ${e3.message ?? ''}`.trim() : donationCount;

    // Diagnose PostgREST schema cache issue:
    // tables exist in DB but PostgREST can't see them → PGRST error or empty message
    const hasCacheIssue = (e1 || e2 || e3) && (!e1?.message && !e2?.message && !e3?.message);
    if (hasCacheIssue) {
      checks.diagnosis = 'PGRST_SCHEMA_CACHE — Tables exist but PostgREST cache is stale. Call POST /api/health to reload.';
    }

    checks.env = {
      url:            process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
      anonKey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'MISSING',
      stripeKey:      process.env.STRIPE_SECRET_KEY ? 'set' : 'MISSING',
      openaiKey:      process.env.OPENAI_API_KEY ? 'set (optional)' : 'not set (optional)',
      resendKey:      process.env.RESEND_API_KEY ? 'set (optional)' : 'not set (optional)',
      appUrl:         process.env.NEXT_PUBLIC_APP_URL ?? 'not set (using fallback)',
    };
  } catch (err) {
    checks.supabase = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const isHealthy = checks.supabase === 'connected';
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}

// POST /api/health — force PostgREST schema cache reload
// This fixes the "tables exist but queries fail" issue after schema migrations.
export async function POST(_req: NextRequest) {
  const ref   = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!ref || !token) {
    // Fall back: use supabaseAdmin to notify PostgREST directly
    try {
      // NOTIFY pgrst forces PostgREST to reload its schema cache
      await supabaseAdmin.rpc('pg_notify' as never, {
        channel: 'pgrst',
        payload: 'reload schema',
      } as never);
    } catch {
      // rpc fallback may fail — use Management API below
    }
  }

  // Primary: Supabase Management API to execute NOTIFY
  if (ref && token) {
    try {
      await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ query: "SELECT pg_notify('pgrst', 'reload schema');" }),
      });
    } catch { /* ignore */ }
  }

  // Wait a moment for PostgREST to reload, then re-check
  await new Promise(r => setTimeout(r, 2000));

  const [
    { count: profileCount,  error: e1 },
    { count: campaignCount, error: e2 },
    { count: donationCount, error: e3 },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*',  { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    ok: !e1 && !e2 && !e3,
    message: (!e1 && !e2 && !e3)
      ? 'PostgREST schema cache reloaded. All tables now accessible.'
      : 'Cache reload attempted. Tables may need another moment.',
    profiles:  e1 ? `error: ${e1.code} ${e1.message}` : profileCount,
    campaigns: e2 ? `error: ${e2.code} ${e2.message}` : campaignCount,
    donations: e3 ? `error: ${e3.code} ${e3.message}` : donationCount,
    ts: Date.now(),
  });
}
