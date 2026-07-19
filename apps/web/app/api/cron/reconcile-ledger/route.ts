import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../../admin/users/_auth';
import { runReconciliation } from '../../../../lib/reconciliation';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// GET /api/cron/reconcile-ledger[?days=N]
//
// Daily reconciliation: compares every online completed donation from the last
// N days (default 2) against its immutable ledger footprint and opens
// de-duplicated reconciliation_exceptions for any missing, duplicated,
// unbalanced, or mis-split entries. Triggered by Vercel Cron (see vercel.json)
// with `Authorization: Bearer ${CRON_SECRET}`; admins may also run it manually.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const daysParam = Number(new URL(request.url).searchParams.get('days'));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 2;

  const result = await runReconciliation(days);
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), days, ...result });
}
