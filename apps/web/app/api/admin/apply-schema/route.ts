import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '../users/_auth';

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'ADMIN_REQUIRED' },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      error: 'In-app schema changes are disabled. Apply reviewed migrations through the release workflow.',
      code: 'RELEASE_WORKFLOW_REQUIRED',
    },
    { status: 410 },
  );
}
