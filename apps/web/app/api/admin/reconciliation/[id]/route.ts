import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../../users/_auth';
import { getExceptionStatus, updateException } from '../../../../../lib/reconciliation';
import {
  EXCEPTION_STATUSES,
  canTransitionException,
  type ExceptionStatus,
} from '../../../../../lib/reconciliation-core';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/reconciliation/:id  { status, resolution_note? }
// Move a reconciliation exception through its workflow (open → assigned →
// resolved/ignored, or re-open). Admin/finance only.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as ExceptionStatus | undefined;
  if (!status || !(EXCEPTION_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const current = await getExceptionStatus(id);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!canTransitionException(current, status)) {
    return NextResponse.json(
      { error: `Cannot move exception from ${current} to ${status}` },
      { status: 409 },
    );
  }

  const note = typeof body?.resolution_note === 'string' ? body.resolution_note : undefined;
  const result = await updateException(id, {
    status,
    resolutionNote: note,
    assigneeId: status === 'assigned' ? admin.id : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
