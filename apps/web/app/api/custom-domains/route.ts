import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';
import {
  normalizeDomain,
  generateVerificationToken,
  verifyDomainOwnership,
  TXT_PREFIX,
} from '../../../lib/custom-domains';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, owner_id, campaign_id, domain, verification_token, status, verified_at, last_checked_at, last_error, created_at';

const CreateSchema = z.object({
  domain: z.string().min(3).max(253),
  campaignId: z.string().uuid().nullable().optional(),
});

const VerifySchema = z.object({ id: z.string().uuid() });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('custom_domains')
    .select(SELECT)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Could not load your domains', code: 'DOMAINS_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ domains: data ?? [], txtPrefix: TXT_PREFIX });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await checkRateLimitDurable(`domain-add:${user.id}`, 10, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many domains added', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid domain', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const normalized = normalizeDomain(parsed.data.domain);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.reason, code: 'INVALID_DOMAIN' }, { status: 400 });
  }

  if (parsed.data.campaignId) {
    const { data: owned, error: cErr } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', parsed.data.campaignId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (cErr) {
      return NextResponse.json({ error: 'Could not verify the campaign', code: 'CAMPAIGN_CHECK_FAILED' }, { status: 503 });
    }
    if (!owned) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('custom_domains')
    .insert({
      owner_id: user.id,
      campaign_id: parsed.data.campaignId ?? null,
      domain: normalized.domain,
      verification_token: generateVerificationToken(),
    })
    .select(SELECT)
    .single();

  if (error) {
    // 23505 = the domain is already claimed. Deliberately does not say by whom:
    // that would confirm another account holds it.
    const taken = (error as { code?: string }).code === '23505';
    return NextResponse.json(
      {
        error: taken ? 'That domain is already registered.' : 'Could not add the domain',
        code: taken ? 'DOMAIN_TAKEN' : 'CREATE_FAILED',
      },
      { status: taken ? 409 : 500 },
    );
  }

  return NextResponse.json({ domain: data, txtPrefix: TXT_PREFIX }, { status: 201 });
}

// ── PATCH /api/custom-domains — run the live DNS check ──────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // A DNS lookup per request is an outbound call an anonymous-ish caller can
  // trigger repeatedly, so it is bounded separately from domain creation.
  if (!(await checkRateLimitDurable(`domain-verify:${user.id}`, 60, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many verification attempts', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = VerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT' }, { status: 400 });

  const { data: row, error } = await supabaseAdmin
    .from('custom_domains')
    .select(SELECT)
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Could not load the domain', code: 'DOMAIN_UNAVAILABLE' }, { status: 503 });
  }
  if (!row || (row as { owner_id: string }).owner_id !== user.id) {
    return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
  }

  const d = row as { id: string; domain: string; verification_token: string };
  const outcome = await verifyDomainOwnership(d.domain, d.verification_token);
  const now = new Date().toISOString();

  // `verified_at` is set only on a real pass, and cleared otherwise — the
  // custom_domains_verified_consistency constraint refuses any other pairing.
  const patch = outcome.verified
    ? { status: 'verified', verified_at: now, last_checked_at: now, last_error: null }
    : { status: 'pending', verified_at: null, last_checked_at: now, last_error: outcome.reason };

  const { data: updated, error: upErr } = await supabaseAdmin
    .from('custom_domains')
    .update(patch)
    .eq('id', d.id)
    .select(SELECT)
    .single();

  if (upErr) {
    return NextResponse.json({ error: 'Could not record the check', code: 'SAVE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    domain: updated,
    verified: outcome.verified,
    reason: outcome.verified ? null : outcome.reason,
  });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id', code: 'INVALID_INPUT' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('custom_domains')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Could not remove the domain', code: 'DELETE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
