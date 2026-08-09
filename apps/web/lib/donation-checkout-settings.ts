import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  DEFAULT_DONATION_CHECKOUT_SETTINGS,
  normalizeDonationCheckoutSettings,
  type DonationCheckoutSettings,
} from '@shared/fees';
import { boundedQuery } from './query-timeout';
import { supabaseAdmin } from './supabase';

export type DonationCheckoutSnapshot = {
  settings: DonationCheckoutSettings;
  revision: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function withLegacySettings(config: Record<string, unknown>): Record<string, unknown> {
  const payment = asRecord(config.payment);
  const checkout = asRecord(payment.donationCheckout);
  const methods = asRecord(checkout.methodFees);
  const legacyProcessingPercent =
    typeof config.donationFeePercent === 'number'
      ? config.donationFeePercent
      : typeof payment.donationFeePercent === 'number'
        ? payment.donationFeePercent
        : undefined;

  if (legacyProcessingPercent === undefined) {
    return {
      ...checkout,
      defaultSupportPercent: checkout.defaultSupportPercent ?? config.defaultDonorTipPercent,
    };
  }

  const legacyMethod = { pct: legacyProcessingPercent };
  return {
    ...checkout,
    defaultSupportPercent: checkout.defaultSupportPercent ?? config.defaultDonorTipPercent,
    methodFees: {
      ...methods,
      stripe: methods.stripe ?? legacyMethod,
      gpay: methods.gpay ?? legacyMethod,
      card: methods.card ?? legacyMethod,
    },
  };
}

export function donationCheckoutSettingsFromPlatformConfig(value: unknown): DonationCheckoutSettings {
  return normalizeDonationCheckoutSettings(withLegacySettings(asRecord(value)));
}

const fetchDonationCheckoutSnapshot = unstable_cache(
  async (): Promise<DonationCheckoutSnapshot> => {
    try {
      const { data, error } = await boundedQuery(() =>
        supabaseAdmin
          .from('platform_settings')
          .select('config, updated_at')
          .eq('id', 1)
          .maybeSingle(),
      );
      if (error) {
        return { settings: normalizeDonationCheckoutSettings(DEFAULT_DONATION_CHECKOUT_SETTINGS), revision: 'defaults' };
      }
      const config = asRecord(data?.config);
      return {
        settings: donationCheckoutSettingsFromPlatformConfig(config),
        revision: typeof data?.updated_at === 'string' && data.updated_at ? data.updated_at : 'defaults',
      };
    } catch {
      return { settings: normalizeDonationCheckoutSettings(DEFAULT_DONATION_CHECKOUT_SETTINGS), revision: 'defaults' };
    }
  },
  ['donation-checkout-settings'],
  { revalidate: 60, tags: ['donation-checkout-settings', 'platform-settings'] },
);

export async function getDonationCheckoutSnapshot(): Promise<DonationCheckoutSnapshot> {
  return fetchDonationCheckoutSnapshot();
}
