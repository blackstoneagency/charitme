import { NextResponse, type NextRequest } from 'next/server';
import { getTopDonors, LEADERBOARD_PERIODS, type LeaderboardPeriod } from '../../../../lib/leaderboard';
import { checkRateLimit } from '../../../../lib/rate-limit';

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`leaderboard-donors:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const url = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const periodParam = url.searchParams.get('period');
  const period: LeaderboardPeriod = LEADERBOARD_PERIODS.includes(periodParam as LeaderboardPeriod)
    ? (periodParam as LeaderboardPeriod)
    : 'all';

  const donors = await getTopDonors(period, limit);
  return NextResponse.json({ donors, period });
}
