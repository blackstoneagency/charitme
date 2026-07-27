import { beforeEach, describe, expect, it, vi } from 'vitest';

const from = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from } }));

import { loadDonorTaxInputs, loadFundraiserTaxInputs } from '../lib/tax-server';

function resolvedBuilder(data: unknown, terminal: 'eq' | 'in' | 'order' | 'range') {
  const result = { data, error: null as { message: string } | null };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  builder[terminal].mockResolvedValue(result);
  return builder;
}

function rejectedBuilder(terminal: 'eq' | 'in' | 'order' | 'range') {
  const builder = resolvedBuilder(null, terminal);
  builder[terminal].mockResolvedValue({ data: null, error: { message: 'query failed' } });
  return builder;
}

beforeEach(() => {
  from.mockReset();
});

describe('loadDonorTaxInputs', () => {
  it('uses only receipt numbers persisted in tax_receipts', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'donations') {
        return resolvedBuilder([{
          id: 'donation-1',
          amount_cents: 5000,
          tip_cents: 0,
          currency: 'usd',
          status: 'completed',
          created_at: '2026-01-02T00:00:00Z',
          campaign_id: 'campaign-1',
          campaigns: { title: 'Community project', user_id: 'owner-1' },
        }], 'range');
      }
      if (table === 'tax_receipts') return resolvedBuilder([], 'range');
      if (table === 'nonprofit_profiles') return resolvedBuilder([], 'in');
      throw new Error(`Unexpected table: ${table}`);
    });

    const [input] = await loadDonorTaxInputs('donor-1');

    expect(input?.receiptNumber).toBeNull();
  });

  it('preserves a persisted official receipt number', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'donations') {
        return resolvedBuilder([{
          id: 'donation-1',
          amount_cents: 5000,
          tip_cents: 0,
          currency: 'usd',
          status: 'completed',
          created_at: '2026-01-02T00:00:00Z',
          campaign_id: 'campaign-1',
          campaigns: { title: 'Community project', user_id: null },
        }], 'range');
      }
      if (table === 'tax_receipts') return resolvedBuilder([{ donation_id: 'donation-1', receipt_number: 'RCP-2026-ABC12345' }], 'range');
      throw new Error(`Unexpected table: ${table}`);
    });

    const [input] = await loadDonorTaxInputs('donor-1');

    expect(input?.receiptNumber).toBe('RCP-2026-ABC12345');
  });

  it('fails instead of returning an incomplete statement when donations cannot load', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'donations') return rejectedBuilder('range');
      if (table === 'tax_receipts') return resolvedBuilder([], 'range');
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(loadDonorTaxInputs('donor-1')).rejects.toThrow('TAX_DATA_UNAVAILABLE');
  });

  it('paginates past the Supabase row cap', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `donation-${index}`,
      amount_cents: 100,
      tip_cents: 0,
      currency: 'usd',
      status: 'completed',
      created_at: '2026-01-02T00:00:00Z',
      campaign_id: 'campaign-1',
      campaigns: { title: 'Community project', user_id: null },
    }));
    const donationBuilder = resolvedBuilder([], 'range');
    donationBuilder.range.mockImplementation((offset: number) => Promise.resolve({
      data: offset === 0 ? firstPage : [{
        ...firstPage[0],
        id: 'donation-1000',
      }],
      error: null,
    }));
    const receiptBuilder = resolvedBuilder([], 'range');

    from.mockImplementation((table: string) => {
      if (table === 'donations') return donationBuilder;
      if (table === 'tax_receipts') return receiptBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const inputs = await loadDonorTaxInputs('donor-1');

    expect(inputs).toHaveLength(1001);
    expect(donationBuilder.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(donationBuilder.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

describe('loadFundraiserTaxInputs', () => {
  it('loads completed donations only for campaigns owned by the user', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'campaigns') {
        return resolvedBuilder([{ id: 'campaign-1', title: 'Owned campaign' }], 'range');
      }
      if (table === 'donations') {
        return resolvedBuilder([{
          amount_cents: 12500,
          tip_cents: 500,
          currency: 'usd',
          status: 'completed',
          created_at: '2026-04-02T00:00:00Z',
          campaign_id: 'campaign-1',
        }], 'range');
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const inputs = await loadFundraiserTaxInputs('owner-1');

    expect(inputs).toEqual([{
      amountCents: 12500,
      tipCents: 500,
      currency: 'usd',
      status: 'completed',
      createdAt: '2026-04-02T00:00:00Z',
      campaignId: 'campaign-1',
      campaignTitle: 'Owned campaign',
    }]);
  });

  it('returns an empty report without querying donations when no campaigns exist', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'campaigns') return resolvedBuilder([], 'range');
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(loadFundraiserTaxInputs('owner-1')).resolves.toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('fails closed when campaign ownership data cannot load', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'campaigns') return rejectedBuilder('range');
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(loadFundraiserTaxInputs('owner-1')).rejects.toThrow('TAX_DATA_UNAVAILABLE');
  });
});
