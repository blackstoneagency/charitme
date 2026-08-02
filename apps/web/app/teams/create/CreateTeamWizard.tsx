'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Create-a-team wizard.
//
// The design shows FIVE steps: Details, Members, Story, Goal, Review. This ships
// the three the platform can actually honour, and says why the other two are not
// here rather than rendering inputs that discard what you type:
//
//   • MEMBERS — `peer_fundraisers` has no membership table. Peer-to-peer works by
//     each supporter creating their OWN page against the same campaign, so
//     "inviting members" is sharing your team link. The wizard shows that link on
//     the final step instead of an invite form whose addresses go nowhere.
//   • STORY — there is no story column on `peer_fundraisers`. A rich-text editor
//     that silently drops its content on submit is worse than no editor.
//
// Both are recorded in todo.md as schema work, not as UI that was skipped.
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignOption {
  id: string;
  slug: string;
  title: string;
}

interface Created {
  slug: string;
  title: string;
  campaignSlug: string;
}

const STEPS = ['Choose a campaign', 'Name your team', 'Set a goal', 'Review'] as const;

const field = {
  padding: '10px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--b2)',
  background: 'var(--s1)',
  color: 'var(--t1)',
  fontSize: '14px',
  width: '100%',
  fontFamily: 'inherit',
} as const;

export default function CreateTeamWizard({ campaigns }: { campaigns: CampaignOption[] }) {
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [goalDollars, setGoalDollars] = useState('500');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState<Created | null>(null);

  const campaign = campaigns.find((c) => c.id === campaignId);
  const goalCents = Math.round(Number(goalDollars) * 100);
  const goalValid = Number.isFinite(goalCents) && goalCents > 0;
  const titleValid = title.trim().length >= 3 && title.trim().length <= 120;

  const canAdvance =
    (step === 0 && Boolean(campaignId)) ||
    (step === 1 && titleValid) ||
    (step === 2 && goalValid) ||
    step === 3;

  const submit = async () => {
    if (!campaign) return;
    setStatus('saving');
    setNotice('');
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/peer-fundraisers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), goalAmount: goalCents }),
      });
      const data = (await res.json().catch(() => null)) as
        | { slug?: string; title?: string; error?: string }
        | null;

      if (!res.ok) {
        setStatus('error');
        // Surface the API's own message: 401 means sign in, 409 means you already
        // run this campaign. A generic failure string would send someone in
        // circles on both.
        setNotice(
          res.status === 401
            ? 'Please sign in first — a team page belongs to your account.'
            : data?.error || 'We could not create the team just now. Please try again.',
        );
        return;
      }

      setStatus('idle');
      setCreated({
        slug: data?.slug ?? '',
        title: data?.title ?? title.trim(),
        campaignSlug: campaign.slug,
      });
    } catch {
      setStatus('error');
      setNotice('We could not create the team just now. Please try again.');
    }
  };

  if (created) {
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://www.charitme.com'}/campaigns/${created.campaignSlug}`;
    return (
      <div style={{ padding: '26px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', maxWidth: '620px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 780, color: 'var(--t1)' }}>
          {created.title} is live
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.6, marginTop: '10px' }}>
          Your team page is raising toward the campaign goal. To add members, share the campaign —
          each person creates their own page, and everything they raise counts toward the same
          total.
        </p>
        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px', marginTop: '18px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Share this link</span>
          <input readOnly value={shareUrl} style={field} onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
          <Link href={`/campaigns/${created.campaignSlug}`} className="kind-start-pill" style={{ display: 'inline-flex' }}>
            View the campaign
          </Link>
          <Link href="/teams" style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
            All teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '620px' }}>
      {/* Step indicator. aria-current marks the active step so it is announced,
          not just coloured. */}
      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontSize: '12px',
                fontWeight: 800,
                color: i <= step ? '#fff' : 'var(--t3)',
                background: i <= step ? 'var(--green-btn, var(--green))' : 'var(--s3)',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: i === step ? 'var(--t1)' : 'var(--t3)' }}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '14px' }}>
        {step === 0 && (
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Which campaign are you raising for?</span>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={field}>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
              Your team raises toward this campaign&rsquo;s goal.
            </span>
          </label>
        )}

        {step === 1 && (
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Team name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Riverside Runners"
              minLength={3}
              maxLength={120}
              style={field}
            />
            <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
              3–120 characters. This is the name supporters will see.
            </span>
          </label>
        )}

        {step === 2 && (
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)' }}>Team goal (USD)</span>
            <input
              type="number"
              min={1}
              step="1"
              value={goalDollars}
              onChange={(e) => setGoalDollars(e.target.value)}
              style={field}
            />
            <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
              You can change this later. Teams that set a specific, explainable goal raise more than
              those that pick a round number.
            </span>
          </label>
        )}

        {step === 3 && (
          <div style={{ padding: '18px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)' }}>
            <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', margin: 0 }}>
              {[
                ['Campaign', campaign?.title ?? '—'],
                ['Team name', title.trim() || '—'],
                ['Goal', goalValid ? `$${(goalCents / 100).toLocaleString()}` : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <dt style={{ fontSize: '13px', color: 'var(--t3)' }}>{k}</dt>
                  <dd style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', margin: 0, textAlign: 'right' }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            style={{ padding: '11px 20px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, minHeight: '24px' }}
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            className="kind-start-pill"
            style={{ display: 'inline-flex', justifyContent: 'center', minHeight: '42px', opacity: canAdvance ? 1 : 0.5 }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={status === 'saving'}
            className="kind-start-pill"
            style={{ display: 'inline-flex', justifyContent: 'center', minHeight: '42px', opacity: status === 'saving' ? 0.6 : 1 }}
          >
            {status === 'saving' ? 'Creating…' : 'Create team'}
          </button>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        style={{ minHeight: '20px', margin: '14px 0 0', fontSize: '13px', fontWeight: 650, color: status === 'error' ? 'var(--red-text)' : 'var(--green-text)' }}
      >
        {notice}
      </p>
    </div>
  );
}
