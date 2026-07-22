import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { resolveFeaturePriceCents } from '../../../../lib/featured';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();

  if (error && error.code !== '42P01') {
    return NextResponse.json(
      { error: 'Could not load featured campaign pricing', code: 'FEATURE_PRICE_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const config = data?.config && typeof data.config === 'object' && !Array.isArray(data.config)
    ? (data.config as Record<string, unknown>)
    : {};
  const payment = config.payment && typeof config.payment === 'object' && !Array.isArray(config.payment)
    ? config.payment
    : undefined;

  return NextResponse.json({ priceCents: resolveFeaturePriceCents(payment) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
