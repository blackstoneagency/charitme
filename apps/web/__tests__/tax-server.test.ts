import { beforeEach, describe, expect, it, vi } from 'vitest';

const from = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from } }));

import { loadDonorTaxInputs } from '../lib/tax-server';

function resolvedBuilder(data: unknown, terminal: 'eq' | 'in' | 'order') {
  const result = { data, error: null };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder[terminal].mockResolvedValue(result);
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
        }], 'order');
      }
      if (table === 'tax_receipts') return resolvedBuilder([], 'eq');
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
        }], 'order');
      }
      if (table === 'tax_receipts') return resolvedBuilder([{ donation_id: 'donation-1', receipt_number: 'RCP-2026-ABC12345' }], 'eq');
      throw new Error(`Unexpected table: ${table}`);
    });

    const [input] = await loadDonorTaxInputs('donor-1');

    expect(input?.receiptNumber).toBe('RCP-2026-ABC12345');
  });
});
