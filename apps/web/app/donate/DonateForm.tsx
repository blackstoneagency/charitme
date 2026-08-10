'use client';

import { useMemo, useState } from 'react';
import type { DonationCheckoutSettings } from '@shared/fees';
import DonateButton from '../campaigns/[slug]/DonateButton';

export type DonateTarget = {
  id: string;
  title: string;
  category: string | null;
  currency: string;
};

export default function DonateForm({
  targets,
  loadFailed,
  checkoutSettings,
  checkoutRevision,
}: {
  targets: DonateTarget[];
  loadFailed: boolean;
  checkoutSettings: DonationCheckoutSettings;
  checkoutRevision: string;
}) {
  const [campaignId, setCampaignId] = useState('');
  const selected = useMemo(
    () => targets.find((target) => target.id === campaignId) ?? null,
    [campaignId, targets],
  );

  return (
    <div className="dn-panel" aria-labelledby="dn-panel-title">
      <h2 id="dn-panel-title" className="dn-panel-title">Make a Donation</h2>
      <p className="dn-panel-sub">Choose a campaign, then review every charge before checkout.</p>

      <label className="dn-field">
        <span className="dn-label">Where Your Gift Goes</span>
        {loadFailed ? (
          <span className="dn-load-error" role="alert">
            We couldn&rsquo;t load campaigns just now. Please refresh in a moment.
          </span>
        ) : (
          <select
            className="dn-select"
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
          >
            <option value="">Choose a cause or campaign</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.category ? `${target.category} - ${target.title}` : target.title}
              </option>
            ))}
          </select>
        )}
      </label>

      {selected ? (
        <div style={{ marginTop: 18 }}>
          <DonateButton
            campaignId={selected.id}
            campaignTitle={selected.title}
            currency={selected.currency}
            checkoutSettings={checkoutSettings}
            checkoutRevision={checkoutRevision}
          />
        </div>
      ) : !loadFailed ? (
        <p style={{ margin: '18px 0 0', color: 'var(--t3)', fontSize: 13 }} role="status">
          Select a campaign to open its secure donation checkout.
        </p>
      ) : null}

      <p className="dn-legal" style={{ marginTop: 18 }}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
        <span>
          Donations to verified 501(c)(3) nonprofits are tax-deductible and receive an
          official receipt. Gifts to personal fundraisers are not deductible.
        </span>
      </p>
    </div>
  );
}
