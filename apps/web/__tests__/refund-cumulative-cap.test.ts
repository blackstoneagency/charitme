import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const route = readFileSync(
  path.join(__dirname, '..', 'app', 'api', 'admin', 'donations', '[id]', 'refund', 'route.ts'),
  'utf8',
);
const migration = readFileSync(
  path.resolve(__dirname, '../../../supabase/migrations/20260906010000_stripe_money_flow_integrity.sql'),
  'utf8',
);

describe('admin refunds reserve principal atomically', () => {
  it('uses the locked Supabase reservation instead of a racy read and insert', () => {
    expect(route).toContain("'reserve_admin_donation_refund'");
    expect(route).toContain('p_requested_cents: input.amount_cents');
    expect(migration).toMatch(/where id = p_donation_id\s+for update/i);
    expect(migration).toMatch(/sum\(amount_cents\)[\s\S]+status not in \('declined', 'failed', 'canceled'\)/i);
  });

  it('refuses missing, invalid, and fully refunded donations', () => {
    expect(route).toContain("refundError('DONATION_NOT_FOUND', 404");
    expect(route).toContain("refundError('ALREADY_REFUNDED', 409");
    expect(route).toContain("refundError('INVALID_REFUND_REQUEST', 400");
  });

  it('marks failed reservations so a safe retry can reserve the amount again', () => {
    expect(route).toContain(".update({ status: 'failed', notes: reason })");
    expect(route).toContain("markReservationFailed(reservation.refund_id, 'Stripe rejected the refund')");
  });
});

describe('the Stripe refund follows the actual charge architecture', () => {
  it('uses deterministic Stripe idempotency', () => {
    expect(route).toContain('idempotencyKey: `admin-donation-refund-${reservation.refund_id}`');
  });

  it('reverses only objects proven to exist on the charge', () => {
    expect(route).toContain("expand: ['latest_charge']");
    expect(route).toContain('...(transferId ? { reverse_transfer: true } : {})');
    expect(route).toContain('...(applicationFeeId ? { refund_application_fee: true } : {})');
    expect(route).not.toMatch(/transfer\|application fee\|no such/i);
  });

  it('converts requested campaign principal into the proportional donor refund', () => {
    expect(route).toContain('(reservation.refund_cents * charge.amount) / reservation.donation_cents');
    expect(route).toContain('reservation.is_full_refund');
    expect(route).toContain('chargeRemainingCents');
  });
});

describe('refund accounting is retry-safe', () => {
  it('stores both principal and gross donor refund amounts', () => {
    expect(migration).toContain('gross_amount_cents bigint');
    expect(route).toContain('refund_reservation_id: reservation.refund_id');
    expect(route).toContain('principal_amount_cents: reservation.refund_cents');
    expect(route).toContain('gross_amount_cents: stripeRefundCents');
  });

  it('updates campaign totals exactly once through a locked database function', () => {
    expect(migration).toContain('create or replace function public.apply_campaign_refund_stats');
    expect(migration).toContain('refund_row.stats_reversed_at is not null');
    expect(migration).toContain('raised_amount = greatest(0, raised_amount - refund_row.amount_cents)');
  });
});
