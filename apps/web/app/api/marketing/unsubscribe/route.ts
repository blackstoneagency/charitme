import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { unsubscribeEmail } from '../../../../lib/marketing-engine';

const Schema = z.object({ email: z.string().email().max(254) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  // Durable, cross-instance limit: this endpoint is unauthenticated and
  // anonymous callers can suppress an arbitrary email, so a per-instance counter does not bound abuse.
  if (!(await checkRateLimitDurable(`mkt-unsub:${ip}`, 10, 60_000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

  await unsubscribeEmail(parsed.data.email);
  return NextResponse.json({ ok: true });
}

// One-click unsubscribe links from emails: GET /api/marketing/unsubscribe?email=...
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') ?? '';
  const parsed = Schema.safeParse({ email });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  await unsubscribeEmail(parsed.data.email);
  return new NextResponse(
    '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>You have been unsubscribed.</h2><p>You will no longer receive marketing emails from CharitMe.</p></body></html>',
    { headers: { 'Content-Type': 'text/html' } },
  );
}
