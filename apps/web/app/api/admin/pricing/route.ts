import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../users/_auth';
import { getPricingAnalytics } from '../../../../lib/pricing-analytics';

export const dynamic = 'force-dynamic';

// GET /api/admin/pricing[?days=N]
// Admin pricing/support analytics from real donation data (avg donation, avg
// support %, support-reduction %, tier distribution). Subscription metrics
// (MRR/ARR/LTV) are added once Stripe billing is wired.
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const daysParam = Number(new URL(request.url).searchParams.get('days'));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30;

  const analytics = await getPricingAnalytics(days);
  return NextResponse.json(analytics);
}
