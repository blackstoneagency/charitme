import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { checkRateLimit } from '../../../lib/rate-limit';

const ReportSchema = z.object({
  campaignId: z.string().uuid(),
  reason: z.string().min(4).max(80),
  details: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  if (!checkRateLimit(`report:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many reports', code: 'RATE_LIMITED' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid report', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }
  await supabaseAdmin.from('campaign_reports').insert({
    campaign_id: parsed.data.campaignId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
    status: 'open',
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
