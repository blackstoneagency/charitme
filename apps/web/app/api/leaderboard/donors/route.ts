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
  return NextResponse.json(
    { donors, period },
    // Public, identical for every caller and slow-changing: let the CDN serve it.
    // Without this every request reached the origin, so the 60/min per-IP limiter
    // fired for ordinary users sharing an IP (offices, universities, mobile CGNAT).
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
