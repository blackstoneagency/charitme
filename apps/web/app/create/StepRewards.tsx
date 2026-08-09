'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Optional donor rewards.
//
// Rewards are held in wizard state and written after publish, because
// POST /api/campaigns/[id]/rewards needs a campaign id that does not exist yet.
// See lib/campaign-rewards-draft.ts for the reasoning and the validation.
//
// ⚠️ This step is SKIPPABLE by design. Rewards suit a product launch and are
// meaningless for a memorial fund, so the empty state is a legitimate final
// answer rather than something to nag about.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MAX_REWARDS_PER_CAMPAIGN,
  REWARD_DESCRIPTION_MAX,
  draftRewardHasContent,
  emptyDraftReward,
  rewardAmountCents,
  type DraftReward,
  type RewardFieldError,
} from '../../lib/campaign-rewards-draft';
import { currencySymbol, formatMoney } from '@shared/currencies';

export interface StepRewardsProps {
  rewards: DraftReward[];
  currency: string;
  onChange: (rewards: DraftReward[]) => void;
  /** Which row failed validation, and why — set by the builder on Continue. */
  fieldError: { key: string; error: RewardFieldError } | null;
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--t2)',
  marginBottom: 6,
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 10,
  border: '1.5px solid var(--b1)',
  background: 'var(--s1)',
  color: 'var(--t1)',
  fontSize: 14.5,
  fontFamily: 'inherit',
};

const INPUT_ERROR: React.CSSProperties = { ...INPUT, borderColor: 'var(--red)' };

function newKey(): string {
  // crypto.randomUUID is unavailable on older mobile Safari, which is a
  // meaningful slice of this audience — fall back rather than throw.
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function StepRewards({ rewards, currency, onChange, fieldError }: StepRewardsProps) {
  const rows = rewards.length > 0 ? rewards : [emptyDraftReward(newKey())];
  const filledCount = rows.filter(draftRewardHasContent).length;
  const canAdd = rows.length < MAX_REWARDS_PER_CAMPAIGN;

  const update = (key: string, patch: Partial<DraftReward>) => {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const remove = (key: string) => {
    const next = rows.filter((r) => r.key !== key);
    onChange(next.length > 0 ? next : [emptyDraftReward(newKey())]);
  };

  const errFor = (key: string, field: RewardFieldError['field']) =>
    fieldError && fieldError.key === key && fieldError.error.field === field
      ? fieldError.error.message
      : null;

  return (
    <div className="cr2-rewards-panel">
      <h2 className="cr2-step-q">Want to thank your donors with something?</h2>
      <p className="cr2-step-help">
        Offer a reward at a donation amount — a shout-out, a sticker, an early copy.
        Plenty of campaigns raise more without any rewards at all, so skip this if it
        does not fit yours.
      </p>

      {rows.map((reward, index) => {
        const cents = rewardAmountCents(reward.amount);
        const titleError = errFor(reward.key, 'title');
        const amountError = errFor(reward.key, 'amount');
        const descriptionError = errFor(reward.key, 'description');
        const deliveryError = errFor(reward.key, 'estimatedDelivery');
        const limitError = errFor(reward.key, 'itemLimit');

        return (
          <fieldset
            key={reward.key}
            style={{
              border: '1.5px solid var(--b1)',
              borderRadius: 14,
              padding: '18px 18px 20px',
              margin: '0 0 16px',
              background: 'var(--s2)',
            }}
          >
            <legend style={{ padding: '0 8px', fontSize: 13, fontWeight: 800, color: 'var(--t2)' }}>
              Reward {index + 1}
            </legend>

            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
              <div>
                <label style={LABEL} htmlFor={`reward-title-${reward.key}`}>Reward name</label>
                <input
                  id={`reward-title-${reward.key}`}
                  style={titleError ? INPUT_ERROR : INPUT}
                  value={reward.title}
                  onChange={(e) => update(reward.key, { title: e.target.value })}
                  placeholder="Hand-written thank-you card"
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? `reward-title-err-${reward.key}` : undefined}
                />
                {titleError && (
                  <p id={`reward-title-err-${reward.key}`} role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0 0' }}>
                    {titleError}
                  </p>
                )}
              </div>

              <div>
                <label style={LABEL} htmlFor={`reward-amount-${reward.key}`}>Donate at least</label>
                <input
                  id={`reward-amount-${reward.key}`}
                  style={amountError ? INPUT_ERROR : INPUT}
                  value={reward.amount}
                  onChange={(e) => update(reward.key, { amount: e.target.value })}
                  inputMode="decimal"
                  placeholder={`${currencySymbol(currency)}25`}
                  aria-invalid={amountError ? true : undefined}
                  aria-describedby={amountError ? `reward-amount-err-${reward.key}` : undefined}
                />
                {amountError ? (
                  <p id={`reward-amount-err-${reward.key}`} role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0 0' }}>
                    {amountError}
                  </p>
                ) : cents !== null ? (
                  <p style={{ color: 'var(--t3)', fontSize: 12.5, margin: '6px 0 0' }}>
                    {formatMoney(cents, currency)} or more
                  </p>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={LABEL} htmlFor={`reward-desc-${reward.key}`}>What they get (optional)</label>
              <textarea
                id={`reward-desc-${reward.key}`}
                style={{ ...(descriptionError ? INPUT_ERROR : INPUT), minHeight: 74, resize: 'vertical' }}
                value={reward.description}
                onChange={(e) => update(reward.key, { description: e.target.value })}
                maxLength={REWARD_DESCRIPTION_MAX}
                placeholder="A card written by the family, posted anywhere in the world."
                aria-invalid={descriptionError ? true : undefined}
                aria-describedby={descriptionError ? `reward-desc-err-${reward.key}` : undefined}
              />
              {descriptionError && (
                <p id={`reward-desc-err-${reward.key}`} role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0 0' }}>
                  {descriptionError}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', marginTop: 14 }}>
              <div>
                <label style={LABEL} htmlFor={`reward-delivery-${reward.key}`}>Estimated delivery (optional)</label>
                <input
                  id={`reward-delivery-${reward.key}`}
                  style={deliveryError ? INPUT_ERROR : INPUT}
                  value={reward.estimatedDelivery}
                  onChange={(e) => update(reward.key, { estimatedDelivery: e.target.value })}
                  placeholder="March 2027"
                  aria-invalid={deliveryError ? true : undefined}
                  aria-describedby={deliveryError ? `reward-delivery-err-${reward.key}` : undefined}
                />
                {deliveryError && (
                  <p id={`reward-delivery-err-${reward.key}`} role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0 0' }}>
                    {deliveryError}
                  </p>
                )}
              </div>

              <div>
                <label style={LABEL} htmlFor={`reward-limit-${reward.key}`}>Limit (optional)</label>
                <input
                  id={`reward-limit-${reward.key}`}
                  style={limitError ? INPUT_ERROR : INPUT}
                  value={reward.itemLimit}
                  onChange={(e) => update(reward.key, { itemLimit: e.target.value })}
                  inputMode="numeric"
                  placeholder="Unlimited"
                  aria-invalid={limitError ? true : undefined}
                  aria-describedby={limitError ? `reward-limit-err-${reward.key}` : undefined}
                />
                {limitError && (
                  <p id={`reward-limit-err-${reward.key}`} role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0 0' }}>
                    {limitError}
                  </p>
                )}
              </div>
            </div>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(reward.key)}
                style={{
                  marginTop: 14, background: 'none', border: 0, padding: 0,
                  color: 'var(--t3)', fontSize: 13.5, fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Remove this reward
              </button>
            )}
          </fieldset>
        );
      })}

      {canAdd ? (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyDraftReward(newKey())])}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 12,
            border: '1.5px dashed var(--b2)', background: 'transparent',
            color: 'var(--t2)', fontSize: 14.5, fontWeight: 800,
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          + Add another reward
        </button>
      ) : (
        <p style={{ color: 'var(--t3)', fontSize: 13.5, margin: 0 }}>
          That is the maximum of {MAX_REWARDS_PER_CAMPAIGN} rewards.
        </p>
      )}

      <p style={{ color: 'var(--t3)', fontSize: 13, margin: '16px 0 0' }}>
        {filledCount === 0
          ? 'No rewards yet — press Continue to skip this step.'
          : `${filledCount} reward${filledCount === 1 ? '' : 's'} will be added when you publish.`}
      </p>
    </div>
  );
}
