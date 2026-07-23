import 'server-only';
import { supabaseAdmin } from './supabase';
import {
  buildTaxStatement,
  donationYears,
  type TaxDonationInput,
  type NonprofitTaxInfo,
  type TaxStatement,
} from './tax';

/**
 * Load a donor's completed donations (across every campaign), resolve which
 * were given to verified receipt-enabled nonprofits, and shape them into the
 * pure tax-statement builder's input. Shared by the JSON/CSV API route and the
 * printable statement page so deductibility is computed identically in both.
 */
export async function loadDonorTaxInputs(donorId: string): Promise<TaxDonationInput[]> {
  const [{ data: rawDonations }, { data: rawReceipts }] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('id, amount_cents, tip_cents, currency, status, created_at, campaign_id, campaigns:campaign_id(title, user_id)')
      .eq('donor_id', donorId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('tax_receipts')
      .select('donation_id, receipt_number')
      .eq('donor_id', donorId),
  ]);

  type DonRow = {
    id: string;
    amount_cents: number;
    tip_cents: number | null;
    currency: string | null;
    status: string;
    created_at: string;
    campaign_id: string;
    campaigns: { title: string; user_id: string } | null;
  };
  const donations = (rawDonations ?? []) as unknown as DonRow[];
  const receiptByDonation = new Map(
    ((rawReceipts ?? []) as { donation_id: string | null; receipt_number: string }[])
      .filter((receipt) => Boolean(receipt.donation_id))
      .map((receipt) => [receipt.donation_id as string, receipt.receipt_number]),
  );

  const ownerIds = [...new Set(donations.map((d) => d.campaigns?.user_id).filter(Boolean) as string[])];
  const nonprofitByOwner = new Map<string, NonprofitTaxInfo>();
  if (ownerIds.length > 0) {
    const { data: nps } = await supabaseAdmin
      .from('nonprofit_profiles')
      .select('owner_id, name, tax_id, verified, verification_status, tax_receipt_enabled')
      .in('owner_id', ownerIds);
    for (const np of (nps ?? []) as {
      owner_id: string; name: string; tax_id: string | null;
      verified: boolean; verification_status: string; tax_receipt_enabled: boolean;
    }[]) {
      const verified = Boolean(np.verified) || np.verification_status === 'verified';
      nonprofitByOwner.set(np.owner_id, {
        name: np.name,
        taxId: np.tax_id ?? null,
        verified,
        taxReceiptEnabled: Boolean(np.tax_receipt_enabled),
      });
    }
  }

  return donations.map((d) => {
    const ownerId = d.campaigns?.user_id;
    const nonprofit = ownerId ? nonprofitByOwner.get(ownerId) ?? null : null;
    const y = new Date(d.created_at).getUTCFullYear();
    return {
      id: d.id,
      amountCents: d.amount_cents,
      tipCents: d.tip_cents ?? 0,
      currency: d.currency,
      status: d.status,
      createdAt: d.created_at,
      campaignId: d.campaign_id,
      campaignTitle: d.campaigns?.title ?? 'CharitMe campaign',
      receiptNumber: receiptByDonation.get(d.id) ?? `RCP-${y}-${d.id.slice(0, 8).toUpperCase()}`,
      nonprofit,
    };
  });
}

export async function getDonorTaxStatement(
  donorId: string,
  year: number,
): Promise<{ statement: TaxStatement; availableYears: number[] }> {
  const inputs = await loadDonorTaxInputs(donorId);
  return { statement: buildTaxStatement(inputs, year), availableYears: donationYears(inputs) };
}
