'use client';

import type { DonationCheckoutSettings } from '@shared/fees';
import DonateButton from '../../campaigns/[slug]/DonateButton';

export default function GuidedDonation({
  campaignId,
  campaignTitle,
  currency,
  checkoutSettings,
  checkoutRevision,
}: {
  campaignId: string;
  campaignTitle: string;
  currency: string;
  checkoutSettings: DonationCheckoutSettings;
  checkoutRevision: string;
}) {
  return (
    <section aria-label={`Donate to ${campaignTitle}`} style={{ maxWidth: 620, minWidth: 0 }}>
      <DonateButton
        campaignId={campaignId}
        campaignTitle={campaignTitle}
        currency={currency}
        checkoutSettings={checkoutSettings}
        checkoutRevision={checkoutRevision}
      />
    </section>
  );
}
