import { NextResponse, type NextRequest } from 'next/server';
import { getTopCampaigns } from '../../../../lib/leaderboard';
import { checkRateLimit } from '../../../../lib/rate-limit';

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`leaderboard-campaigns:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const url = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  const campaigns = await getTopCampaigns(limit);
  return NextResponse.json({ campaigns });
}
