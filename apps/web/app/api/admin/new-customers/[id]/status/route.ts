import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  status: z.enum(['new', 'enriched', 'contacted', 'qualified', 'converted', 'rejected']),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid status' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('business_leads')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .select('id, status')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  return NextResponse.json({ id: data.id, status: data.status });
}
