'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ONBOARDING_STEPS,
  STEP_META,
  onboardingProgress,
  stepPosition,
  nextStep,
  previousStep,
  type OnboardingStep,
  type OnboardingState,
} from '../../lib/onboarding-core';

type SuggestedCampaign = { id: string; slug: string; title: string; category: string | null };

/**
 * Four-step welcome tour.
 *
 * Every control here writes to a real endpoint — `PATCH /api/profile` and
 * `POST /api/saved-campaigns`. Nothing is a placeholder, and "Skip for now" is a
 * real link out rather than a fake dismissal, because there is no flag column to
 * record a dismissal in and pretending otherwise would lose the choice.
 */
export default function WelcomeTour({
  initial,
  state: initialState,
  firstName,
  suggested,
  suggestionsFailed,
}: {
  initial: OnboardingStep;
  state: OnboardingState;
  firstName: string | null;
  suggested: SuggestedCampaign[];
  suggestionsFailed: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(initial);
  const [state, setState] = useState<OnboardingState>(initialState);
  const [name, setName] = useState(firstName ?? '');
  const [updates, setUpdates] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const progress = onboardingProgress(state);
  const { index, total } = stepPosition(step);
  const meta = STEP_META[step];

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name, or skip this step.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: trimmed }),
      });
      if (!res.ok) { setError('We could not save that. Please try again.'); return; }
      setState((s) => ({ ...s, hasName: true }));
      setNotice('Saved.');
      goTo('causes');
      router.refresh();
    } catch {
      setError('We could not reach the server.');
    } finally { setBusy(false); }
  }

  async function savePreferences() {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_updates: updates, notification_marketing: marketing }),
      });
      if (!res.ok) { setError('We could not save your preferences.'); return; }
      setNotice('Preferences saved.');
      goTo('start');
      router.refresh();
    } catch {
      setError('We could not reach the server.');
    } finally { setBusy(false); }
  }

  async function toggleSave(campaign: SuggestedCampaign) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/saved-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      if (!res.ok) { setError('We could not save that campaign.'); return; }
      setSaved((prev) => {
        const next = new Set(prev);
        if (next.has(campaign.id)) next.delete(campaign.id); else next.add(campaign.id);
        setState((s) => ({ ...s, savedCount: next.size }));
        return next;
      });
      router.refresh();
    } catch {
      setError('We could not reach the server.');
    } finally { setBusy(false); }
  }

  function goTo(target: OnboardingStep) {
    setStep(target);
    setError('');
    // Move focus to the panel heading so a keyboard or screen-reader user lands
    // on the new step rather than staying on a button that has just changed
    // meaning underneath them.
    requestAnimationFrame(() => {
      document.getElementById('tour-step-heading')?.focus();
    });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, minWidth: 0 }}>
      {/* Step rail — a real nav, so someone can jump back to a finished step. */}
      <nav aria-label="Setup steps">
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
          {ONBOARDING_STEPS.map((s, i) => {
            const status = progress[s];
            const isCurrent = s === step;
            return (
              <li key={s} style={{ minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => goTo(s)}
                  aria-current={isCurrent ? 'step' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, minWidth: 0,
                    padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                    border: `1px solid ${isCurrent ? 'var(--brand-text)' : 'var(--b1)'}`,
                    background: isCurrent ? 'var(--tint-violet)' : 'var(--s1)',
                    color: 'var(--t1)', fontSize: 13, fontWeight: 700,
                  }}
                >
                  {/* Status is conveyed by TEXT as well as colour — a tick or a
                      number, never colour alone. */}
                  <span aria-hidden="true" style={{ fontWeight: 800, color: status === 'done' ? 'var(--green-text)' : 'var(--t3)' }}>
                    {status === 'done' ? '✓' : i + 1}
                  </span>
                  <span>{STEP_META[s].title}</span>
                  <span className="sr-only">{status === 'done' ? ' (done)' : status === 'current' ? ' (current step)' : ' (not started)'}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section
        aria-labelledby="tour-step-heading"
        style={{ padding: 20, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', minWidth: 0 }}
      >
        <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--t3)' }}>
          Step {index} of {total}
        </p>
        <h2 id="tour-step-heading" tabIndex={-1} style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800, color: 'var(--t1)', outline: 'none' }}>
          {meta.title}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--t2)', maxWidth: 560 }}>{meta.blurb}</p>

        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--red-text)' }}>{error}</p>}
        {notice && <p role="status" style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--green-text)' }}>{notice}</p>}

        {step === 'profile' && (
          <form onSubmit={saveName} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, maxWidth: 420 }}>
            <label htmlFor="tour-name" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
              <span style={labelStyle}>Your name</span>
              <input
                id="tour-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                required
                style={inputStyle}
              />
            </label>
            <div>
              <button type="submit" className="kf-primary" disabled={busy} style={{ minHeight: 44 }}>
                {busy ? 'Saving…' : 'Save and continue'}
              </button>
            </div>
          </form>
        )}

        {step === 'causes' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {suggestionsFailed ? (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--red-text)' }}>
                We could not load campaign suggestions. That is a read failure, not
                an empty site — <Link href="/campaigns" style={linkStyle}>browse campaigns</Link> instead.
              </p>
            ) : suggested.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--t3)' }}>
                No live campaigns to suggest yet. <Link href="/campaigns" style={linkStyle}>Browse campaigns</Link> when there are.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
                {suggested.map((c) => (
                  <li key={c.id} style={{ padding: 12, border: '1px solid var(--b1)', borderRadius: 'var(--r)', background: 'var(--s2)', minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                    <Link href={`/campaigns/${c.slug}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', overflowWrap: 'anywhere' }}>
                      {c.title}
                    </Link>
                    {c.category && <span style={{ fontSize: 12, color: 'var(--t3)' }}>{c.category}</span>}
                    <button
                      type="button"
                      onClick={() => void toggleSave(c)}
                      disabled={busy}
                      aria-pressed={saved.has(c.id)}
                      className="kf-outline"
                      style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                      {saved.has(c.id) ? 'Saved ✓' : 'Save this'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 'updates' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, maxWidth: 520 }}>
            {/* The description is a SIBLING linked by aria-describedby rather
                than nested inside the label: a label should name the control,
                not carry a paragraph of explanation with it. */}
            <div style={checkRow}>
              <input
                id="pref-updates"
                type="checkbox"
                checked={updates}
                onChange={(e) => setUpdates(e.target.checked)}
                aria-describedby="pref-updates-help"
                style={{ width: 18, height: 18, marginTop: 2, flex: '0 0 auto' }}
              />
              <span style={{ minWidth: 0 }}>
                <label htmlFor="pref-updates" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--t1)', cursor: 'pointer' }}>
                  Campaign updates
                </label>
                <span id="pref-updates-help" style={{ fontSize: 13, color: 'var(--t3)' }}>
                  News from campaigns you have given to or saved.
                </span>
              </span>
            </div>
            <div style={checkRow}>
              <input
                id="pref-marketing"
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                aria-describedby="pref-marketing-help"
                style={{ width: 18, height: 18, marginTop: 2, flex: '0 0 auto' }}
              />
              <span style={{ minWidth: 0 }}>
                <label htmlFor="pref-marketing" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--t1)', cursor: 'pointer' }}>
                  Occasional platform news
                </label>
                <span id="pref-marketing-help" style={{ fontSize: 13, color: 'var(--t3)' }}>
                  Off unless you turn it on. We do not sell your address.
                </span>
              </span>
            </div>
            <div>
              <button type="button" onClick={() => void savePreferences()} disabled={busy} className="kf-primary" style={{ minHeight: 44 }}>
                {busy ? 'Saving…' : 'Save preferences'}
              </button>
            </div>
          </div>
        )}

        {step === 'start' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, minWidth: 0 }}>
            <Link href="/campaigns" className="kf-primary" style={{ minHeight: 44, textDecoration: 'none', alignItems: 'center', display: 'inline-flex' }}>
              Find something to support
            </Link>
            <Link href="/create" className="kf-outline" style={{ minHeight: 44, textDecoration: 'none', alignItems: 'center', display: 'inline-flex' }}>
              Start a campaign
            </Link>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 18, minWidth: 0 }}>
          {previousStep(step) && (
            <button type="button" onClick={() => goTo(previousStep(step)!)} style={linkButton}>← Back</button>
          )}
          {nextStep(step) && (
            <button type="button" onClick={() => goTo(nextStep(step)!)} style={linkButton}>Skip this step →</button>
          )}
          {/* A real link out, not a fake dismissal: there is no flag column to
              record "don't show again", so pretending to remember would lose the
              choice silently. */}
          {/* Padded to a 44px target: the sweep measured this at 148x20, which
              fails WCAG 2.2 SC 2.5.8 (24x24 minimum) and is awkward with a thumb
              regardless. */}
          <Link
            href="/dashboard"
            style={{ ...linkStyle, fontSize: 13, display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 0' }}
          >
            Go to my dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--t2)' };
const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, maxWidth: '100%', padding: '11px 12px', fontSize: 15,
  fontFamily: 'inherit', color: 'var(--t1)', background: 'var(--s2)',
  border: '1px solid var(--b1)', borderRadius: 'var(--r)',
};
const checkRow: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0,
  padding: 12, border: '1px solid var(--b1)', borderRadius: 'var(--r)', background: 'var(--s2)',
};
const linkButton: React.CSSProperties = {
  fontSize: 13, fontWeight: 650, color: 'var(--t2)', background: 'none', border: 'none',
  padding: '11px 0', minHeight: 44, cursor: 'pointer', textDecoration: 'underline',
};
const linkStyle = { color: 'var(--brand-text)', fontWeight: 650 } as const;
