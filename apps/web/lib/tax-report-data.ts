import 'server-only';

import { supabaseAdmin } from './supabase';
import type { TaxDonationSource } from './tax-report';

const LEGACY_SELECT = 'id, amount_cents, tip_cents, processing_fee_cents, currency, status, created_at, campaign_id, campaigns(title, nonprofit_verified)';
const ENHANCED_SELECT = 'id, amount_cents, tip_cents, processing_fee_cents, currency, status, created_at, campaign_id, campaigns(title, nonprofit_verified, nonprofit_profiles(name, ein, tax_id, verified, verification_status, tax_receipt_enabled))';

export type TaxReportYear = number | 'all';

type TaxDonationQueryOptions = {
  donorId: string;
  year: TaxReportYear;
};

function runTaxQuery(select: string, options: TaxDonationQueryOptions) {
  let filtered = supabaseAdmin
    .from('donations')
    .select(select)
    .eq('donor_id', options.donorId)
    .in('status', ['completed', 'refunded'])
    .order('created_at', { ascending: false });
  if (options.year !== 'all') {
    filtered = filtered
      .gte('created_at', `${options.year}-01-01T00:00:00.000Z`)
      .lt('created_at', `${options.year + 1}-01-01T00:00:00.000Z`);
  }
  return filtered;
}

export async function getTaxDonationSources(options: TaxDonationQueryOptions): Promise<{ data: TaxDonationSource[]; error: string | null }> {
  const enhanced = await runTaxQuery(ENHANCED_SELECT, options);
  if (!enhanced.error) return { data: (enhanced.data ?? []) as unknown as TaxDonationSource[], error: null };

  const legacy = await runTaxQuery(LEGACY_SELECT, options);
  if (legacy.error) return { data: [], error: 'Tax donation query failed' };
  return { data: (legacy.data ?? []) as unknown as TaxDonationSource[], error: null };
}
