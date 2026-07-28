import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '../admin/users/_auth';
import { supabaseAdmin } from '../../../lib/supabase';
import {
  ONE_TIME_PAYMENT_METHOD_TYPES,
  RECURRING_PAYMENT_METHOD_TYPES,
  reconcilePaymentMethods,
} from '../../../lib/stripe-payment-methods';

// GET /api/health — public liveness; append ?details=1 for admin diagnostics.
export async function GET(request: NextRequest): Promise<NextResponse> {
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
    checks.profiles  = e1 ? { status: 'error', code: e1.code ?? 'QUERY_FAILED' } : profileCount;
    checks.campaigns = e2 ? { status: 'error', code: e2.code ?? 'QUERY_FAILED' } : campaignCount;
    checks.donations = e3 ? { status: 'error', code: e3.code ?? 'QUERY_FAILED' } : donationCount;

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

    // Which build is actually serving. Without this, "is my merge live yet?" can
    // only be answered by probing for behaviour — which is how a queued deploy
    // got mistaken for a shipped one during the 2026-07-26 quota outage. Vercel
    // injects these; they are not secret (a commit SHA reveals nothing on its
    // own) but they stay behind the admin gate so the PUBLIC health response
    // remains minimal, per the contract test.
    checks.deployment = {
      commit:      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? 'unknown (not on Vercel)',
      branch:      process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
      environment: process.env.VERCEL_ENV ?? 'unknown',
    };
  } catch {
    checks.supabase = 'error';
    checks.errorCode = 'SUPABASE_UNAVAILABLE';
  }

  // ── Payment methods actually enabled on the Stripe account ────────────────
  //
  // ONE_TIME_PAYMENT_METHOD_TYPES is hand-maintained and its comment records a
  // one-off verification. Nothing re-checked it, and the failure is silent:
  // Stripe rejects the WHOLE Checkout session when it names an inactive method,
  // often without saying which, so a single deactivation in the Dashboard
  // collapses every donation to card-only. Donors stop being offered Cash App,
  // Klarna, bank debit and the rest, and no error is raised.
  //
  // Read-only (`GET /v1/account`) — it never creates a charge.
  checks.paymentMethods = await (async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { status: 'not-configured', reason: 'STRIPE_SECRET_KEY is not set' };
    try {
      const res = await fetch('https://api.stripe.com/v1/account', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store',
      });
      // Status only — a Stripe error body can echo the request.
      if (!res.ok) return { status: 'unreadable', reason: `Stripe returned ${res.status}` };
      const account = (await res.json()) as { capabilities?: Record<string, unknown> };
      const oneTime = reconcilePaymentMethods(ONE_TIME_PAYMENT_METHOD_TYPES, account.capabilities);
      const recurring = reconcilePaymentMethods(RECURRING_PAYMENT_METHOD_TYPES, account.capabilities);
      return {
        // `degraded` is the actionable state: we are offering a method the
        // account cannot process, which breaks the whole session.
        status: oneTime.inactive.length === 0 && recurring.inactive.length === 0 ? 'ok' : 'degraded',
        oneTime,
        recurring,
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'TimeoutError';
      return { status: 'unreadable', reason: timedOut ? 'Stripe did not respond within 8s' : 'Stripe request failed' };
    }
  })();

  const isHealthy = checks.supabase === 'connected';
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}

// POST /api/health — force PostgREST schema cache reload
// This fixes the "tables exist but queries fail" issue after schema migrations.
export async function POST(_req: NextRequest): Promise<NextResponse> {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }, { status: 403 });

  const { error: reloadError } = await supabaseAdmin.rpc('reload_postgrest_schema_cache');
  if (reloadError) {
    return NextResponse.json(
      {
        error: 'PostgREST schema cache reload failed.',
        code: 'SCHEMA_RELOAD_FAILED',
      },
      { status: 503 },
    );
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  const [
    { count: profileCount,  error: e1 },
    { count: campaignCount, error: e2 },
    { count: donationCount, error: e3 },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*',  { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }),
  ]);

  const ok = !e1 && !e2 && !e3;
  return NextResponse.json({
    ok,
    message: ok
      ? 'PostgREST schema cache reloaded. All tables are accessible.'
      : 'PostgREST reloaded, but required tables are not accessible.',
    ...(!ok ? { error: 'Schema cache verification failed.', code: 'SCHEMA_CACHE_UNAVAILABLE' } : {}),
    profiles:  e1 ? { status: 'error', code: e1.code ?? 'QUERY_FAILED' } : profileCount,
    campaigns: e2 ? { status: 'error', code: e2.code ?? 'QUERY_FAILED' } : campaignCount,
    donations: e3 ? { status: 'error', code: e3.code ?? 'QUERY_FAILED' } : donationCount,
    ts: Date.now(),
  }, { status: ok ? 200 : 503 });
}
