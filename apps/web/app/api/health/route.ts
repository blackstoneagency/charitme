import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '../admin/users/_auth';
import { supabaseAdmin } from '../../../lib/supabase';

// GET /api/health — public liveness; append ?details=1 for admin diagnostics.
export async function GET(request: NextRequest) {
  const details = new URL(request.url).searchParams.get('details') === '1';
  if (!details) return NextResponse.json({ status: 'ok', ts: Date.now() });

  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }, { status: 403 });

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

    // Non-secret config readout so operators can verify env wiring from prod
    // without exposing any secret value (booleans + key MODE + a public int only).
    const stripeKeyRaw = process.env.STRIPE_SECRET_KEY;
    const stripeKeyMode = !stripeKeyRaw
      ? 'MISSING'
      : stripeKeyRaw.trim().startsWith('sk_live_')
        ? 'live'
        : stripeKeyRaw.trim().startsWith('sk_test_')
          ? 'test'
          : 'unrecognized';
    checks.env = {
      url:                 process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING',
      serviceRoleKey:      process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
      anonKey:             process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'MISSING',
      stripeKey:           stripeKeyRaw ? 'set' : 'MISSING',
      stripeKeyMode,
      // true if the value has leading/trailing whitespace (the LB-002 failure mode)
      stripeKeyHasWhitespace: stripeKeyRaw ? stripeKeyRaw !== stripeKeyRaw.trim() : false,
      publishableKey:      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'set' : 'MISSING',
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'set' : 'MISSING',
      // A placeholder like `whsec_connect...` is NOT a real secret (LB-003).
      stripeConnectWebhookSecret: !process.env.STRIPE_CONNECT_WEBHOOK_SECRET
        ? 'MISSING'
        : /placeholder|whsec_connect\.\.\.|^whsec_connect$/i.test(process.env.STRIPE_CONNECT_WEBHOOK_SECRET.trim())
          ? 'PLACEHOLDER'
          : 'set',
      defaultDonorTipPercent: process.env.DEFAULT_DONOR_TIP_PERCENT ?? '(unset → code default 15)',
      openaiKey:           process.env.OPENAI_API_KEY ? 'set (optional)' : 'not set (optional)',
      resendKey:           process.env.RESEND_API_KEY ? 'set (optional)' : 'not set (optional)',
      appUrl:              process.env.NEXT_PUBLIC_APP_URL ?? 'not set (using fallback)',
    };
  } catch {
    checks.supabase = 'error';
    checks.errorCode = 'SUPABASE_UNAVAILABLE';
  }

  const isHealthy = checks.supabase === 'connected';
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}

// POST /api/health — force PostgREST schema cache reload
// This fixes the "tables exist but queries fail" issue after schema migrations.
export async function POST(_req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }, { status: 403 });

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

  // Primary: Supabase Management API — grant permissions AND reload cache
  if (ref && token) {
    try {
      // Step 1: grant all permissions to PostgREST roles (the real fix)
      await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ query: `
          grant usage on schema public to anon, authenticated, service_role;
          grant all   on all tables    in schema public to anon, authenticated, service_role;
          grant all   on all sequences in schema public to anon, authenticated, service_role;
          grant all   on all routines  in schema public to anon, authenticated, service_role;
        ` }),
      });
      // Step 2: reload PostgREST schema cache
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
