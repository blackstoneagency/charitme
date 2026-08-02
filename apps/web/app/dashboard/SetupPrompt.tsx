import 'server-only';
import Link from 'next/link';
import { supabaseAdmin } from '../../lib/supabase';
import {
  onboardingProgress,
  completedCount,
  isOnboardingComplete,
  COMPLETABLE_STEPS,
  STEP_META,
  type OnboardingState,
} from '../../lib/onboarding-core';

/**
 * Entry point to the welcome tour, shown on the dashboard only while setup is
 * unfinished.
 *
 * ⚠️ **Deliberately not a permanent sidebar entry.** A one-time setup flow parked
 * in the navigation is clutter for every established user, forever. This prompt
 * retires itself the moment the underlying rows say setup is done — and because
 * progress is derived rather than flagged, it also disappears if the person did
 * those things somewhere else entirely, instead of nagging about work already
 * finished.
 */
export default async function SetupPrompt({ userId }: { userId: string }) {
  const [profile, savedCount] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('saved_campaigns').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  // A failed read must not invent a half-finished setup and nag someone who is
  // already done. Saying nothing is the safe direction for a prompt.
  if (profile.error || savedCount.error) return null;

  const fullName = (profile.data?.full_name as string | null) ?? null;
  const state: OnboardingState = {
    hasName: Boolean(fullName && fullName.trim()),
    savedCount: savedCount.count ?? 0,
  };

  if (isOnboardingComplete(state)) return null;

  const progress = onboardingProgress(state);
  const done = completedCount(state);
  const total = COMPLETABLE_STEPS.length;
  const remaining = COMPLETABLE_STEPS.filter((step) => progress[step] !== 'done');

  return (
    <section
      aria-labelledby="setup-prompt-heading"
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between',
        minWidth: 0, margin: '0 0 20px', padding: '14px 18px',
        border: '1px solid var(--b2)', borderRadius: 'var(--rl)', background: 'var(--tint-violet)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2 id="setup-prompt-heading" style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 750, color: 'var(--t1)' }}>
          Finish setting up your account
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--t2)' }}>
          {/* Progress is stated as a fraction AND named, so it is useful without
              relying on a progress bar or on colour. */}
          {done} of {total} done — next: {STEP_META[remaining[0]!].title.toLowerCase()}.
        </p>
      </div>
      <Link
        href="/welcome"
        className="kf-primary"
        style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', flex: '0 0 auto' }}
      >
        Continue setup
      </Link>
    </section>
  );
}
