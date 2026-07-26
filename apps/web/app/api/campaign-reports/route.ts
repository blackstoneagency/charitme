import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';

const ReportSchema = z.object({
  campaignId: z.string().uuid(),
  reason: z.string().min(4).max(80),
  details: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  // Durable, cross-instance limit: this endpoint is unauthenticated and
  // anonymous abuse reports are written straight to `campaign_reports`, so a per-instance counter does not bound abuse.
  if (!(await checkRateLimitDurable(`report:${ip}`, 5, 60_000))) {
    return NextResponse.json({ error: 'Too many reports', code: 'RATE_LIMITED' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid report', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }
  // The insert result MUST be checked. This is the abuse-reporting path: the UI
  // tells the reporter "our trust and safety team reviews all reports within 24
  // hours", so silently swallowing a failed insert means a fraud report is lost
  // while the reporter is told it succeeded. A bogus campaignId raises a foreign
  // key violation (23503) — that is a client error, not a server error.
  const { error } = await supabaseAdmin.from('campaign_reports').insert({
    campaign_id: parsed.data.campaignId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
    status: 'open',
  });

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    console.error('[campaign-reports] insert failed', error.code, error.message);
    return NextResponse.json({ error: 'Could not file report', code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
