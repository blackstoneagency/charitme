import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { formatCents } from '@shared/currencies';
import { toCsv } from '../../../../lib/csv';
import { buildTaxReportRecords, type TaxDonationSource } from '../../../../lib/tax-report';

export const dynamic = 'force-dynamic';

const YearSchema = z.union([
  z.literal('all'),
  z.coerce.number().int().min(2000).max(new Date().getUTCFullYear() + 1),
]).default(new Date().getUTCFullYear());

function dateLabel(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const yearResult = YearSchema.safeParse(request.nextUrl.searchParams.get('year') ?? undefined);
  if (!yearResult.success) {
    return NextResponse.json({ error: 'Invalid tax year', code: 'INVALID_INPUT' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('donations')
    .select('id, amount_cents, tip_cents, processing_fee_cents, currency, status, created_at, campaign_id, campaigns(title, nonprofit_verified)')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  query = query.in('status', ['completed', 'refunded']);
  if (yearResult.data !== 'all') {
    query = query
      .gte('created_at', `${yearResult.data}-01-01T00:00:00.000Z`)
      .lt('created_at', `${yearResult.data + 1}-01-01T00:00:00.000Z`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Tax reporting is temporarily unavailable', code: 'REPORT_UNAVAILABLE' }, { status: 503 });
  }

  const donations = (data ?? []) as unknown as TaxDonationSource[];
  const donationIds = donations.map((donation) => donation.id);
  let receiptReferences: { donation_id: string; receipt_number: string }[] = [];
  if (donationIds.length > 0) {
    const { data: receipts } = await supabaseAdmin
      .from('tax_receipts')
      .select('donation_id, receipt_number')
      .in('donation_id', donationIds);
    receiptReferences = (receipts ?? []) as { donation_id: string; receipt_number: string }[];
  }
  const records = buildTaxReportRecords(donations, receiptReferences);
  const format = request.nextUrl.searchParams.get('format') ?? 'csv';
  if (format === 'json') {
    const deductibleByCurrency = records.reduce<Record<string, number>>((totals, record) => {
      const currency = record.currency.toLowerCase();
      totals[currency] = (totals[currency] ?? 0) + record.tax_deductible_amount_cents;
      return totals;
    }, {});
    return NextResponse.json({ year: yearResult.data, records, deductibleByCurrency });
  }
  if (format !== 'csv') {
    return NextResponse.json({ error: 'Unsupported report format', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const rows = records.map((record) => ({
    tax_year: record.tax_year,
    receipt_number: record.receipt_number,
    donation_date: dateLabel(record.donation_date ?? record.created_at),
    campaign: record.campaign_title ?? '',
    recipient: record.recipient_name ?? '',
    recipient_ein: record.recipient_ein ?? '',
    donation_amount: formatCents(record.amount_cents, record.currency),
    optional_tip: formatCents(record.tip_cents, record.currency),
    processing_fee: formatCents(record.processing_fee_cents, record.currency),
    tax_deductible_amount: formatCents(record.tax_deductible_amount_cents, record.currency),
    status: record.status,
    currency: record.currency.toUpperCase(),
    note: record.tax_deductible_amount_cents > 0
      ? 'Verify deductibility with your tax professional and retain this receipt.'
      : 'This gift is recorded but is not marked tax deductible by CharitMe.',
  }));
  const headers = ['tax_year', 'receipt_number', 'donation_date', 'campaign', 'recipient', 'recipient_ein', 'donation_amount', 'optional_tip', 'processing_fee', 'tax_deductible_amount', 'status', 'currency', 'note'];
  const yearLabel = yearResult.data === 'all' ? 'all' : String(yearResult.data);
  return new NextResponse(toCsv(rows, headers), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="charitme-tax-report-${yearLabel}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
