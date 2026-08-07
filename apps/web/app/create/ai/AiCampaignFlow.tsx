'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AI_STEPS, AI_CAUSE_CHOICES, EMPTY_DRAFT, canAdvance, nextStep, prevStep,
  restateCause, suggestImpactLines, impactAllocatedCents, impactRemainingCents,
  impactOverAllocatedCents, AI_MIN_STORY_CHARS, AI_ALL_CATEGORIES,
  type AiDraft, type AiStepId, type ImpactLine,
} from '../../../lib/ai-campaign-steps';
import { getPhotosForCategory } from '../../../lib/photo-catalog';

// ─────────────────────────────────────────────────────────────────────────────
// The twelve-step AI campaign builder.
//
// Every step's *decision* lives in `lib/ai-campaign-steps.ts` and is unit
// tested; this file is the surface. The rule that keeps them honest: the Next
// button's `disabled` and the submit handler read the SAME `canAdvance` call,
// so an enabled button can never be refused on submit.
//
// AI is used where it helps and is never load-bearing: every generating step
// has a working manual path, because `OPENAI_API_KEY` is optional in this
// product and a wizard that dead-ends without it is not shippable.
// ─────────────────────────────────────────────────────────────────────────────

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export default function AiCampaignFlow({ initialCause = '' }: { initialCause?: string }) {
  const [step, setStep] = useState<AiStepId>('cause');
  const [draft, setDraft] = useState<AiDraft>({ ...EMPTY_DRAFT, cause: initialCause });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titleIdeas, setTitleIdeas] = useState<string[]>([]);
  const [goalWhy, setGoalWhy] = useState('');
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);
  const [teamEmail, setTeamEmail] = useState('');
  const [teamAdded, setTeamAdded] = useState<string[]>([]);

  const meta = useMemo(() => AI_STEPS.find((s) => s.id === step)!, [step]);
  const gate = useMemo(() => canAdvance(step, draft), [step, draft]);
  const set = useCallback(
    (patch: Partial<AiDraft>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );

  const covers = useMemo(() => getPhotosForCategory(draft.category || 'Other', 6), [draft.category]);

  // ── AI calls, each with a manual fallback path ─────────────────────────────

  const generate = useCallback(async () => {
    setBusy('story'); setError(null);
    try {
      const out = await postJson<{ title: string; story: string }>('/api/ai/campaign', {
        category: draft.category || 'Other',
        goalAmount: Math.max(100, draft.goalCents || 500_000),
        beneficiary: draft.beneficiary || draft.cause.slice(0, 110) || 'the beneficiary',
        notes: [draft.cause, draft.location && `Location: ${draft.location}`, draft.timeframe && `Timeframe: ${draft.timeframe}`]
          .filter(Boolean).join('. ').slice(0, 3999),
      });
      set({ story: out.story ?? '', title: draft.title || out.title || '' });
      if (out.title) setTitleIdeas((prev) => [...new Set([out.title, ...prev])].slice(0, 4));
    } catch (e) {
      // The story box stays editable, so a failed generation is a setback and
      // never a dead end. Saying so is the difference between the two.
      setError(e instanceof Error ? `${e.message} — you can write your story yourself below.` : 'Generation failed.');
    } finally { setBusy(null); }
  }, [draft, set]);

  const recommendGoal = useCallback(async () => {
    setBusy('goal'); setError(null);
    try {
      const out = await postJson<{ goal_cents: number; reasoning: string }>('/api/ai/goal-recommend', {
        category: draft.category || 'Other',
        beneficiary: draft.beneficiary || draft.cause.slice(0, 190),
        notes: draft.cause.slice(0, 1999),
        location: draft.location || undefined,
      });
      set({ goalCents: out.goal_cents });
      setGoalWhy(out.reasoning ?? '');
    } catch (e) {
      setError(e instanceof Error ? `${e.message} — enter a goal yourself below.` : 'Recommendation failed.');
    } finally { setBusy(null); }
  }, [draft, set]);

  const createCampaign = useCallback(async () => {
    setBusy('create'); setError(null);
    try {
      const out = await postJson<{ id: string; slug: string }>('/api/campaigns', {
        title: draft.title.trim().slice(0, 100),
        tagline: draft.understood.slice(0, 160) || undefined,
        description: draft.story,
        goalAmount: draft.goalCents,
        category: draft.category,
        coverImageUrl: draft.coverImageUrl || undefined,
        location: draft.location || undefined,
        beneficiaryName: draft.beneficiary.slice(0, 120) || undefined,
        status: 'active',
      });
      setCreated({ id: out.id, slug: out.slug });
      setStep('team');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the campaign.');
    } finally { setBusy(null); }
  }, [draft]);

  const loadCaptions = useCallback(async () => {
    if (!created) return;
    setBusy('captions'); setError(null);
    try {
      const kinds = ['facebook', 'twitter', 'instagram'] as const;
      const out = await Promise.all(
        kinds.map((type) => postJson<{ content: string }>('/api/ai/content', { type, campaignId: created.id })),
      );
      setCaptions(out.map((o) => o.content).filter(Boolean));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the sharing kit.');
    } finally { setBusy(null); }
  }, [created]);

  const inviteTeammate = useCallback(async () => {
    if (!created || !teamEmail.trim()) return;
    setBusy('team'); setError(null);
    try {
      await postJson('/api/team-members', { campaignId: created.id, email: teamEmail.trim(), role: 'member' });
      setTeamAdded((prev) => [...prev, teamEmail.trim()]);
      setTeamEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that invite.');
    } finally { setBusy(null); }
  }, [created, teamEmail]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goNext = useCallback(async () => {
    if (!canAdvance(step, draft).ok) return;   // same gate the button reads
    if (step === 'review') { await createCampaign(); return; }
    const to = nextStep(step);
    if (!to) return;
    setError(null);
    // Pre-fill the step being entered, so nobody lands on an empty screen.
    if (to === 'understand' && !draft.understood) set({ understood: restateCause(draft) });
    if (to === 'story' && !draft.story) void generate();
    if (to === 'goal' && !draft.goalCents) void recommendGoal();
    if (to === 'impact' && draft.impact.length === 0) set({ impact: suggestImpactLines(draft.goalCents, draft.category) });
    if (to === 'sharing' && captions.length === 0) void loadCaptions();
    setStep(to);
  }, [step, draft, set, generate, recommendGoal, loadCaptions, captions.length, createCampaign]);

  const back = prevStep(step);

  return (
    <div className="aiw">
      <header className="aiw-head">
        <p className="aiw-kicker">Create a Campaign with AI</p>
        <h1 className="aiw-title">{meta.title}</h1>
        <p className="aiw-blurb">{meta.blurb}</p>
      </header>

      <StepRail current={meta.number} />

      {error && <p className="aiw-error" role="alert">{error}</p>}

      <div className="aiw-panel">
        {step === 'cause' && (
          <>
            <fieldset className="aiw-field">
              <legend>What would you like to raise money for?</legend>
              <div className="aiw-chips">
                {AI_CAUSE_CHOICES.map((c) => (
                  <button
                    key={c} type="button"
                    className={`aiw-chip${draft.category === c ? ' is-on' : ''}`}
                    aria-pressed={draft.category === c}
                    onClick={() => set({ category: c })}
                  >{c}</button>
                ))}
              </div>
              {/* The design shows a short row of common causes, but a campaign
                  can be any of the eighteen real categories. Without this, the
                  other ten are unreachable from the AI flow and someone raising
                  for, say, Environment has to abandon it for the manual wizard. */}
              <label className="aiw-more">
                <span>Something else?</span>
                <select
                  value={AI_CAUSE_CHOICES.includes(draft.category as never) ? '' : draft.category}
                  onChange={(e) => e.target.value && set({ category: e.target.value })}
                >
                  <option value="">More categories…</option>
                  {AI_ALL_CATEGORIES.filter((c) => !AI_CAUSE_CHOICES.includes(c)).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </fieldset>
            <label className="aiw-field">
              <span>Describe your cause in a few words</span>
              <textarea
                rows={4} value={draft.cause}
                onChange={(e) => set({ cause: e.target.value, understood: '', confirmed: false })}
                placeholder="e.g. a clean water project bringing safe drinking water to rural communities"
              />
            </label>
          </>
        )}

        {step === 'understand' && (
          <>
            <blockquote className="aiw-quote">{draft.understood || restateCause(draft)}</blockquote>
            <p className="aiw-note">
              This is your own wording, played back. Nothing has been added to it — if it reads
              wrong, the fix is upstream.
            </p>
            <div className="aiw-row">
              <button type="button" className="aiw-btn aiw-btn--primary" onClick={() => set({ confirmed: true })} aria-pressed={draft.confirmed}>
                {draft.confirmed ? '✓ Confirmed' : "Yes, that's right"}
              </button>
              <button type="button" className="aiw-btn" onClick={() => { set({ confirmed: false }); setStep('cause'); }}>
                No, let me change it
              </button>
            </div>
          </>
        )}

        {step === 'questions' && (
          <>
            <label className="aiw-field">
              <span>Who will the campaign help?</span>
              <input value={draft.beneficiary} onChange={(e) => set({ beneficiary: e.target.value })} placeholder="e.g. families in the Turkana region" />
            </label>
            <label className="aiw-field">
              <span>Where is this based? <em>(optional)</em></span>
              <input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="City, country" />
            </label>
            <label className="aiw-field">
              <span>How soon do you need the funds? <em>(optional)</em></span>
              <select value={draft.timeframe} onChange={(e) => set({ timeframe: e.target.value })}>
                <option value="">No fixed deadline</option>
                <option>Within a month</option>
                <option>1–3 months</option>
                <option>3–6 months</option>
                <option>More than 6 months</option>
              </select>
            </label>
          </>
        )}

        {step === 'story' && (
          <>
            <label className="aiw-field">
              <span>Your campaign story</span>
              <textarea rows={12} value={draft.story} onChange={(e) => set({ story: e.target.value })} placeholder="Write your story, or generate a first draft." />
            </label>
            <p className="aiw-count" aria-live="polite">
              {draft.story.trim().length} / {AI_MIN_STORY_CHARS} characters minimum
            </p>
            <div className="aiw-row">
              <button type="button" className="aiw-btn" onClick={generate} disabled={busy === 'story'}>
                {busy === 'story' ? 'Writing…' : draft.story ? 'Regenerate' : 'Write a first draft'}
              </button>
            </div>
          </>
        )}

        {step === 'title' && (
          <>
            <label className="aiw-field">
              <span>Campaign title</span>
              <input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={100} placeholder="Clean Water for All" />
            </label>
            {titleIdeas.length > 0 && (
              <div className="aiw-ideas">
                {titleIdeas.map((t) => (
                  <button key={t} type="button" className="aiw-chip" onClick={() => set({ title: t })}>{t}</button>
                ))}
              </div>
            )}
            <fieldset className="aiw-field">
              <legend>Cover image</legend>
              <div className="aiw-covers">
                {covers.map((src) => (
                  <button
                    key={src} type="button"
                    className={`aiw-cover${draft.coverImageUrl === src ? ' is-on' : ''}`}
                    aria-pressed={draft.coverImageUrl === src}
                    aria-label="Use this cover image"
                    onClick={() => set({ coverImageUrl: src })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 'goal' && (
          <>
            <div className="aiw-goal">
              <span className="aiw-goal-amount">{money(draft.goalCents)}</span>
              {goalWhy && <p className="aiw-note">{goalWhy}</p>}
            </div>
            <label className="aiw-field">
              <span>Set a different goal (USD)</span>
              <input
                type="number" min={1000} step={100}
                value={draft.goalCents ? Math.round(draft.goalCents / 100) : ''}
                onChange={(e) => set({ goalCents: Math.round(Number(e.target.value || 0) * 100), impact: [] })}
              />
            </label>
            <div className="aiw-row">
              <button type="button" className="aiw-btn" onClick={recommendGoal} disabled={busy === 'goal'}>
                {busy === 'goal' ? 'Checking…' : 'Recommend a goal'}
              </button>
            </div>
          </>
        )}

        {step === 'impact' && (
          <ImpactEditor
            goalCents={draft.goalCents}
            lines={draft.impact}
            onChange={(impact) => set({ impact })}
            onSuggest={() => set({ impact: suggestImpactLines(draft.goalCents, draft.category) })}
          />
        )}

        {step === 'review' && (
          <dl className="aiw-review">
            <div><dt>Title</dt><dd>{draft.title}</dd></div>
            <div><dt>Category</dt><dd>{draft.category}</dd></div>
            <div><dt>Goal</dt><dd>{money(draft.goalCents)}</dd></div>
            <div><dt>Helps</dt><dd>{draft.beneficiary}</dd></div>
            {draft.location && <div><dt>Location</dt><dd>{draft.location}</dd></div>}
            <div><dt>Story</dt><dd className="aiw-review-story">{draft.story}</dd></div>
          </dl>
        )}

        {step === 'team' && created && (
          <>
            <p className="aiw-note">Your campaign is live. Invite anyone who will help run it — or skip and do it later.</p>
            <div className="aiw-row">
              <input type="email" value={teamEmail} onChange={(e) => setTeamEmail(e.target.value)} placeholder="teammate@example.com" aria-label="Teammate email" />
              <button type="button" className="aiw-btn" onClick={inviteTeammate} disabled={busy === 'team' || !teamEmail.trim()}>
                {busy === 'team' ? 'Inviting…' : 'Invite'}
              </button>
            </div>
            {teamAdded.length > 0 && (
              <ul className="aiw-added">{teamAdded.map((e) => <li key={e}>✓ Invited {e}</li>)}</ul>
            )}
          </>
        )}

        {step === 'sharing' && (
          <>
            {busy === 'captions' && <p className="aiw-note">Building your sharing kit…</p>}
            {captions.length > 0 ? (
              <ul className="aiw-captions">
                {captions.map((c, i) => (
                  <li key={i}>
                    <p>{c}</p>
                    <button type="button" className="aiw-btn" onClick={() => void navigator.clipboard?.writeText(c)}>Copy</button>
                  </li>
                ))}
              </ul>
            ) : busy !== 'captions' && (
              <div className="aiw-row">
                <button type="button" className="aiw-btn" onClick={loadCaptions}>Generate captions</button>
              </div>
            )}
          </>
        )}

        {step === 'tips' && (
          <ul className="aiw-tips">
            <li><strong>Share it in the first 48 hours.</strong> Campaigns that reach their first ten donors quickly raise far more, because early donations are what make later ones feel safe.</li>
            <li><strong>Post an update every time something changes.</strong> An update is the only evidence a donor has that their money did something.</li>
            <li><strong>Thank every donor by name</strong> (unless they gave anonymously). It is the single most repeated behaviour among campaigns that get second donations.</li>
            <li><strong>Ask directly, one person at a time.</strong> A broadcast post converts far worse than a message that names the person you are asking.</li>
          </ul>
        )}

        {step === 'ready' && created && (
          <div className="aiw-done">
            <p className="aiw-done-mark" aria-hidden="true">🎉</p>
            <h2>Your campaign is ready</h2>
            <p className="aiw-note">{draft.title} — {money(draft.goalCents)} goal</p>
            <div className="aiw-row">
              <Link className="aiw-btn aiw-btn--primary" href={`/campaigns/${created.slug}`}>Go to campaign</Link>
              <Link className="aiw-btn" href={`/dashboard/campaigns/${created.id}`}>Manage it</Link>
            </div>
          </div>
        )}
      </div>

      <nav className="aiw-nav">
        {back ? (
          <button type="button" className="aiw-btn" onClick={() => { setError(null); setStep(back); }}>Back</button>
        ) : <span />}

        <div className="aiw-nav-right">
          {!gate.ok && gate.reason && <span className="aiw-gate" id="aiw-gate">{gate.reason}</span>}
          {meta.optional && (
            <button type="button" className="aiw-btn" onClick={() => { const to = nextStep(step); if (to) setStep(to); }}>Skip</button>
          )}
          {step !== 'ready' && (
            <button
              type="button"
              className="aiw-btn aiw-btn--primary"
              onClick={goNext}
              disabled={!gate.ok || busy !== null}
              aria-describedby={!gate.ok && gate.reason ? 'aiw-gate' : undefined}
            >
              {step === 'review' ? (busy === 'create' ? 'Creating…' : 'Create my campaign') : 'Next'}
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

/** The dot rail from the design. Each dot names its step for screen readers. */
function StepRail({ current }: { current: number }) {
  return (
    <ol className="aiw-rail" aria-label={`Step ${current} of ${AI_STEPS.length}`}>
      {AI_STEPS.map((s) => {
        const state = s.number < current ? 'done' : s.number === current ? 'now' : 'todo';
        return (
          <li key={s.id} className={`aiw-dot is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="aiw-dot-n" aria-hidden="true">{s.number}</span>
            <span className="cl-visually-hidden">{`Step ${s.number}: ${s.title}${state === 'done' ? ' (done)' : ''}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ImpactEditor({
  goalCents, lines, onChange, onSuggest,
}: {
  goalCents: number;
  lines: ImpactLine[];
  onChange: (l: ImpactLine[]) => void;
  onSuggest: () => void;
}) {
  const allocated = impactAllocatedCents(lines);
  const remaining = impactRemainingCents(goalCents, lines);
  const over = impactOverAllocatedCents(goalCents, lines);
  const edit = (i: number, patch: Partial<ImpactLine>) =>
    onChange(lines.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  return (
    <>
      {/* The design draws finished-looking tiles ("2,500+ People Served"). This
          campaign has raised nothing, so presenting those as results would be a
          fabricated outcome. It is labelled as a plan, and every figure below is
          one the organizer typed. */}
      <p className="aiw-note">
        This is your <strong>plan</strong> for the money, not a result. Donors see it labelled that
        way, and you can update it as the campaign progresses.
      </p>
      <ul className="aiw-impact">
        {lines.map((l, i) => (
          <li key={i}>
            <input
              aria-label={`What this funds, line ${i + 1}`}
              value={l.label}
              onChange={(e) => edit(i, { label: e.target.value })}
            />
            <input
              aria-label={`Amount for line ${i + 1} in dollars`}
              type="number" min={0} step={50}
              value={l.cents ? Math.round(l.cents / 100) : ''}
              onChange={(e) => edit(i, { cents: Math.round(Number(e.target.value || 0) * 100) })}
            />
            <button type="button" className="aiw-btn" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(lines.filter((_, n) => n !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="aiw-row">
        <button type="button" className="aiw-btn" onClick={() => onChange([...lines, { label: '', quantity: 1, cents: 0 }])}>Add a line</button>
        <button type="button" className="aiw-btn" onClick={onSuggest}>Suggest a split</button>
      </div>
      <p className="aiw-note" aria-live="polite">
        {money(allocated)} of {money(goalCents)} planned
        {over > 0
          ? ` — ${money(over)} more than your goal.`
          : remaining > 0 ? ` — ${money(remaining)} still to allocate.` : ' — fully allocated.'}
      </p>
    </>
  );
}
