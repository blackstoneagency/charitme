import 'server-only';
import type { Metadata } from 'next';
import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { initialStep, isOnboardingComplete, type OnboardingState } from '../../lib/onboarding-core';
import WelcomeTour from './WelcomeTour';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Welcome to CharitMe',
  description: 'Set up your account in a few short steps.',
  // Signed-in setup flow: never indexed, and it carries the person's own name.
  robots: { index: false, follow: false },
};

/**
 * New-user welcome tour.
 *
 * Nothing like this existed — a new account landed on the dashboard with no name
 * set, nothing saved, and no indication of what to do first.
 *
 * ⚠️ **Progress is DERIVED from real rows, not from a flag.** There is no
 * `onboarding_completed_at` column, and adding one would have needed a migration
 * this sandbox cannot apply — which would have made the whole page inert in
 * every environment where that migration had not run. Deriving also means the
 * tour tells the truth when someone sets their name in settings instead: a flag
 * would have kept nagging them.
 */
async function loadState(userId: string): Promise<{ state: OnboardingState; firstName: string | null }> {
  // `supabaseAdmin` is a Proxy that THROWS on property access when the env is
  // missing, so `.from(...)` can throw before a query runs — which the
  // `savedCount.error` check below cannot see. The degraded answer keeps this
  // function's existing bias: an unknown step counts as UNFINISHED, so the tour
  // asks again rather than silently skipping a step someone never did.
  let profile: { data: { full_name: string | null } | null };
  let savedCount: { count: number | null; error: unknown };
  try {
    [profile, savedCount] = (await Promise.all([
      supabaseAdmin.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('saved_campaigns').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])) as [typeof profile, typeof savedCount];
  } catch {
    return { state: { hasName: false, savedCount: 0 }, firstName: null };
  }

  const fullName = (profile.data?.full_name as string | null) ?? null;
  return {
    state: {
      hasName: Boolean(fullName && fullName.trim()),
      // A failed count must not read as "nothing saved" and re-prompt someone
      // who has already done this step, so an error leaves the step unfinished
      // rather than falsely complete — the safe direction is to ask again, not
      // to skip.
      savedCount: savedCount.error ? 0 : (savedCount.count ?? 0),
    },
    firstName: fullName,
  };
}

/** `null` means the read FAILED — kept distinct from "no live campaigns". */
async function loadSuggestions(): Promise<{ id: string; slug: string; title: string; category: string | null }[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, category')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(6);
    if (error) {
      console.warn('[welcome] suggestions failed', { code: error.code });
      return null;
    }
    return (data ?? []) as { id: string; slug: string; title: string; category: string | null }[];
  } catch {
    return null;
  }
}

export default async function WelcomePage() {
  const user = await requireUser();
  const [{ state, firstName }, suggested] = await Promise.all([loadState(user.id), loadSuggestions()]);

  const complete = isOnboardingComplete(state);

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 56px', minWidth: 0 }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, lineHeight: 1.15, fontWeight: 850, color: 'var(--t1)', letterSpacing: '-0.02em' }}>
          {firstName ? `Welcome to CharitMe, ${firstName.split(' ')[0]}` : 'Welcome to CharitMe'}
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--t2)', maxWidth: 620 }}>
          {complete
            ? 'Your account is set up. Everything below stays editable — come back any time.'
            : 'A few short steps. You can skip any of them and change everything later.'}
        </p>
      </header>

      <WelcomeTour
        initial={initialStep(state)}
        state={state}
        firstName={firstName}
        suggested={suggested ?? []}
        suggestionsFailed={suggested === null}
      />
    </main>
  );
}
