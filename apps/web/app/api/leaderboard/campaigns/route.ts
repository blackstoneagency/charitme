import { NextResponse, type NextRequest } from 'next/server';
import { getTopCampaignsForPeriod, LEADERBOARD_PERIODS, type LeaderboardPeriod } from '../../../../lib/leaderboard';
import { checkRateLimit } from '../../../../lib/rate-limit';

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`leaderboard-campaigns:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const url = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  // Unknown or absent period falls back to 'all' rather than 400ing: this is a
  // public read behind a CDN cache, and an empty leaderboard is a worse answer
  // to a typo'd query string than the default view.
  const raw = url.searchParams.get('period');
  const period: LeaderboardPeriod =
    raw && (LEADERBOARD_PERIODS as string[]).includes(raw) ? (raw as LeaderboardPeriod) : 'all';

  const campaigns = await getTopCampaignsForPeriod(period, limit);
  return NextResponse.json(
    { campaigns },
    // See the donors route: public, identical per caller, slow-changing — cache at
    // the CDN so the per-IP limiter stops firing for shared-IP users.
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
