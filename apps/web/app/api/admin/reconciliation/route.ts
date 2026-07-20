import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../users/_auth';
import { listExceptions } from '../../../../lib/reconciliation';
import { EXCEPTION_STATUSES, type ExceptionStatus } from '../../../../lib/reconciliation-core';

export const dynamic = 'force-dynamic';

// GET /api/admin/reconciliation[?status=open|assigned|resolved|ignored|all]
// Admin/finance list of reconciliation exceptions raised by the daily job.
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = new URL(request.url).searchParams.get('status') ?? 'open';
  const status: ExceptionStatus | 'all' =
    raw === 'all' || (EXCEPTION_STATUSES as readonly string[]).includes(raw)
      ? (raw as ExceptionStatus | 'all')
      : 'open';

  const exceptions = await listExceptions(status);
  return NextResponse.json({ exceptions });
}
