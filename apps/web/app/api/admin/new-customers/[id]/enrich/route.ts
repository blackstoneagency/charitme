import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../../../users/_auth';
import { enrichLead } from '../../../../../../lib/lead-enrichment';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await enrichLead(id, admin.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
