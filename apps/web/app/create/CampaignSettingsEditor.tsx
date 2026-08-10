'use client';

import { PublicIcon } from '../../components/PublicIcon';
import { SUPPORTED_CURRENCIES } from '@shared/currencies';
import type {
  CampaignFaq,
  CampaignMilestone,
  DonationTier,
} from '../../lib/campaign-builder-model';

type Props = {
  currency: string;
  recurringEnabled: boolean;
  anonymousEnabled: boolean;
  visibility: string;
  policyAccepted: boolean;
  donationTiers: DonationTier[];
  faqs: CampaignFaq[];
  milestones: CampaignMilestone[];
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  onField: (
    field: 'currency' | 'recurringEnabled' | 'anonymousEnabled' | 'visibility'
      | 'seoTitle' | 'seoDescription' | 'socialTitle' | 'socialDescription' | 'policyAccepted',
    value: string,
  ) => void;
  onDonationTiers: (items: DonationTier[]) => void;
  onFaqs: (items: CampaignFaq[]) => void;
  onMilestones: (items: CampaignMilestone[]) => void;
};

export default function CampaignSettingsEditor(props: Props) {
  return (
    <div className="cb-settings">
      <h2 className="cr2-step-q">Choose campaign settings</h2>
      <p className="cr2-step-help">These defaults work for most fundraisers. You can change them before publishing.</p>

      <div className="cb-settings-grid">
        <label className="cr2-field">
          <span className="cr2-label">Currency</span>
          <select value={props.currency} onChange={(event) => props.onField('currency', event.target.value)}>
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>{currency.code} - {currency.name}</option>
            ))}
          </select>
        </label>

        <fieldset className="cb-segment-field">
          <legend>Who can find it?</legend>
          <div className="cb-segment" role="radiogroup" aria-label="Campaign visibility">
            {[
              ['public', 'Public'],
              ['unlisted', 'Link only'],
              ['private', 'Private'],
            ].map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={props.visibility === value} className={props.visibility === value ? 'is-selected' : ''} onClick={() => props.onField('visibility', value)}>{label}</button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="cb-toggle-list">
        <label htmlFor="campaign-recurring-enabled" aria-label="Allow recurring donations">
          <input id="campaign-recurring-enabled" type="checkbox" checked={props.recurringEnabled} onChange={(event) => props.onField('recurringEnabled', String(event.target.checked))} />
          <span><strong>Allow recurring donations</strong><small>Supporters can choose a monthly gift.</small></span>
        </label>
        <label htmlFor="campaign-anonymous-enabled" aria-label="Allow anonymous donations">
          <input id="campaign-anonymous-enabled" type="checkbox" checked={props.anonymousEnabled} onChange={(event) => props.onField('anonymousEnabled', String(event.target.checked))} />
          <span><strong>Allow anonymous donations</strong><small>Donor identity stays hidden publicly, while payment records remain complete.</small></span>
        </label>
      </div>

      <details className="cb-disclosure">
        <summary>Suggested donation amounts <span>{props.donationTiers.length}</span></summary>
        <div className="cb-disclosure-body">
          {props.donationTiers.map((tier, index) => (
            <div className="cb-inline-editor" key={tier.id}>
              <label><span>Amount ({props.currency})</span><input type="number" min="1" inputMode="decimal" value={tier.amountCents / 100} onChange={(event) => props.onDonationTiers(props.donationTiers.map((item) => item.id === tier.id ? { ...item, amountCents: Math.round(Number(event.target.value || 0) * 100) } : item))} /></label>
              <label><span>Impact label</span><input value={tier.label} maxLength={120} onChange={(event) => props.onDonationTiers(props.donationTiers.map((item) => item.id === tier.id ? { ...item, label: event.target.value } : item))} /></label>
              <button type="button" className="cb-icon-command" onClick={() => props.onDonationTiers(props.donationTiers.filter((item) => item.id !== tier.id))} aria-label={`Remove donation amount ${index + 1}`}><PublicIcon name="x" /></button>
            </div>
          ))}
          <button type="button" className="cb-secondary-command" onClick={() => props.onDonationTiers([...props.donationTiers, { id: crypto.randomUUID(), amountCents: 2500, label: 'Helps with an essential' }])}><PublicIcon name="plus" /> Add amount</button>
        </div>
      </details>

      <details className="cb-disclosure">
        <summary>Donor FAQs <span>{props.faqs.length}</span></summary>
        <div className="cb-disclosure-body">
          {props.faqs.map((faq, index) => (
            <div className="cb-stack-editor" key={faq.id}>
              <label><span>Question</span><input value={faq.question} maxLength={300} onChange={(event) => props.onFaqs(props.faqs.map((item) => item.id === faq.id ? { ...item, question: event.target.value } : item))} /></label>
              <label><span>Answer</span><textarea rows={3} value={faq.answer} maxLength={2000} onChange={(event) => props.onFaqs(props.faqs.map((item) => item.id === faq.id ? { ...item, answer: event.target.value } : item))} /></label>
              <button type="button" className="cb-text-command" onClick={() => props.onFaqs(props.faqs.filter((item) => item.id !== faq.id))}>Remove FAQ {index + 1}</button>
            </div>
          ))}
          <button type="button" className="cb-secondary-command" onClick={() => props.onFaqs([...props.faqs, { id: crypto.randomUUID(), question: '', answer: '', aiGenerated: false }])}><PublicIcon name="plus" /> Add FAQ</button>
        </div>
      </details>

      <details className="cb-disclosure">
        <summary>Campaign milestones <span>{props.milestones.length}</span></summary>
        <div className="cb-disclosure-body">
          {props.milestones.map((milestone, index) => (
            <div className="cb-inline-editor" key={milestone.id}>
              <label><span>Milestone</span><input value={milestone.title} maxLength={160} onChange={(event) => props.onMilestones(props.milestones.map((item) => item.id === milestone.id ? { ...item, title: event.target.value } : item))} /></label>
              <label><span>Target ({props.currency})</span><input type="number" min="1" inputMode="decimal" value={milestone.targetCents / 100} onChange={(event) => props.onMilestones(props.milestones.map((item) => item.id === milestone.id ? { ...item, targetCents: Math.round(Number(event.target.value || 0) * 100) } : item))} /></label>
              <button type="button" className="cb-icon-command" onClick={() => props.onMilestones(props.milestones.filter((item) => item.id !== milestone.id))} aria-label={`Remove milestone ${index + 1}`}><PublicIcon name="x" /></button>
            </div>
          ))}
          <button type="button" className="cb-secondary-command" onClick={() => props.onMilestones([...props.milestones, { id: crypto.randomUUID(), title: '', description: '', targetCents: 0 }])}><PublicIcon name="plus" /> Add milestone</button>
        </div>
      </details>

      <details className="cb-disclosure">
        <summary>Search and social preview</summary>
        <div className="cb-disclosure-body cb-settings-grid">
          <label className="cr2-field"><span className="cr2-label">Search title</span><input value={props.seoTitle} maxLength={60} onChange={(event) => props.onField('seoTitle', event.target.value)} /></label>
          <label className="cr2-field"><span className="cr2-label">Search description</span><textarea rows={3} value={props.seoDescription} maxLength={160} onChange={(event) => props.onField('seoDescription', event.target.value)} /></label>
          <label className="cr2-field"><span className="cr2-label">Social title</span><input value={props.socialTitle} maxLength={100} onChange={(event) => props.onField('socialTitle', event.target.value)} /></label>
          <label className="cr2-field"><span className="cr2-label">Social description</span><textarea rows={3} value={props.socialDescription} maxLength={300} onChange={(event) => props.onField('socialDescription', event.target.value)} /></label>
        </div>
      </details>

      <label className="cb-policy-check">
        <input type="checkbox" checked={props.policyAccepted} onChange={(event) => props.onField('policyAccepted', String(event.target.checked))} />
        <span>I confirm the campaign is accurate, I have permission to share its content, and funds will be used as described.</span>
      </label>
    </div>
  );
}
