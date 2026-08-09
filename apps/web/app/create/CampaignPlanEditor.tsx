'use client';

import { PublicIcon } from '../../components/PublicIcon';
import { currencySymbol, formatMoney } from '@shared/currencies';
import {
  suggestUseOfFunds,
  totalUseOfFunds,
  type UseOfFundsItem,
} from '../../lib/campaign-builder-model';

type Props = {
  goalCents: number;
  category: string;
  currency: string;
  items: UseOfFundsItem[];
  onChange: (items: UseOfFundsItem[]) => void;
};

export default function CampaignPlanEditor({ goalCents, category, currency, items, onChange }: Props) {
  const total = totalUseOfFunds(items);
  const difference = goalCents - total;
  const edit = (id: string, patch: Partial<UseOfFundsItem>) => {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const add = () => {
    onChange([...items, { id: crypto.randomUUID(), label: '', amountCents: Math.max(0, difference) }]);
  };

  return (
    <div className="cb-plan">
      <h2 className="cr2-step-q">What will the funds cover?</h2>
      <p className="cr2-step-help">A clear budget helps donors understand exactly what their support makes possible.</p>

      {items.length === 0 ? (
        <button type="button" className="cb-secondary-command" onClick={() => onChange(suggestUseOfFunds(goalCents, category))} disabled={goalCents <= 0}>
          <PublicIcon name="ai" /> Suggest a budget
        </button>
      ) : (
        <div className="cb-plan-lines">
          {items.map((item, index) => (
            <div className="cb-plan-line" key={item.id}>
              <label>
                <span>Expense {index + 1}</span>
                <input
                  value={item.label}
                  maxLength={120}
                  onChange={(event) => edit(item.id, { label: event.target.value })}
                  placeholder="Treatment, supplies, travel..."
                />
              </label>
              <label>
                <span>Amount</span>
                <div className="cb-money-input">
                  <span>{currencySymbol(currency)}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={item.amountCents ? item.amountCents / 100 : ''}
                    onChange={(event) => edit(item.id, { amountCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) })}
                    aria-label={`Amount for expense ${index + 1} in ${currency}`}
                  />
                </div>
              </label>
              <button type="button" className="cb-icon-command" onClick={() => onChange(items.filter((row) => row.id !== item.id))} aria-label={`Remove expense ${index + 1}`}>
                <PublicIcon name="x" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="cb-plan-summary" aria-live="polite">
        <span><strong>{formatMoney(total, currency)}</strong> planned</span>
        <span className={difference === 0 ? 'is-ready' : 'is-open'}>
          {difference === 0
            ? 'Budget matches your goal'
            : difference > 0 ? `${formatMoney(difference, currency)} left to assign` : `${formatMoney(Math.abs(difference), currency)} over goal`}
        </span>
      </div>

      <div className="cb-command-row">
        <button type="button" className="cb-secondary-command" onClick={add}><PublicIcon name="plus" /> Add expense</button>
        <button type="button" className="cb-secondary-command" onClick={() => onChange(suggestUseOfFunds(goalCents, category))} disabled={goalCents <= 0}><PublicIcon name="ai" /> Rebalance</button>
      </div>
    </div>
  );
}
