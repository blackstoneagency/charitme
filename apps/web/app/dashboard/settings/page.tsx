import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import NavigationPreferences from './NavigationPreferences';
import { loadShellSession } from '../../../lib/shell-session-server';
import { dashboardNavigationFor } from '../../../lib/persona-navigation';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { getUserEntitlements } from '../../../lib/entitlements';
import SettingsClient from './SettingsClient';
import PlanFeaturesCard from './PlanFeaturesCard';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ subscription?: string; plan?: string }>;
}

type ProfileRow = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  plan: string | null;
  stripe_customer_id: string | null;
  org_name: string | null;
  org_website: string | null;
  org_tagline: string | null;
  timezone: string | null;
  currency: string | null;
  language: string | null;
  date_format: string | null;
  time_format: string | null;
  show_public_profile: boolean | null;
  campaign_recommendations: boolean | null;
  notification_email: boolean | null;
  notification_updates: boolean | null;
  notification_marketing: boolean | null;
};

async function fetchProfile(userId: string): Promise<ProfileRow> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select(
        'full_name,bio,avatar_url,plan,stripe_customer_id,' +
        'org_name,org_website,org_tagline,' +
        'timezone,currency,language,date_format,time_format,' +
        'show_public_profile,campaign_recommendations,' +
        'notification_email,notification_updates,notification_marketing'
      )
      .eq('id', userId)
      .single();
    if (!data) return defaultProfile();
    return data as unknown as ProfileRow;
  } catch {
    return defaultProfile();
  }
}

function defaultProfile(): ProfileRow {
  return {
    full_name: null, bio: null, avatar_url: null, plan: 'free', stripe_customer_id: null,
    org_name: null, org_website: null, org_tagline: null,
    timezone: 'America/New_York', currency: 'usd', language: 'en',
    date_format: 'MM/DD/YYYY', time_format: '12h',
    show_public_profile: true, campaign_recommendations: true,
    notification_email: true, notification_updates: true, notification_marketing: false,
  };
}

/** `null` = could not read. 0 would claim the user has no active campaigns. */
async function fetchCampaignCount(userId: string): Promise<number | null> {
  try {
    const { count, error } = await supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  // The caller's own persona navigation, for the customization control below.
  const session = await loadShellSession();
  const navItems = dashboardNavigationFor(session.navRole).map(({ label, href }) => ({ label, href }));
  const [profile, sp, campaignsCount, entitlements] = await Promise.all([
    fetchProfile(user.id),
    searchParams,
    fetchCampaignCount(user.id),
    getUserEntitlements(user.id),
  ]);

  const subscriptionSuccess = sp.subscription === 'success';
  const upgradedPlan = sp.plan ?? '';

  return (
    <CharitMeShell active="Settings">
      <TopBar title="Settings" subtitle="Manage your account, organisation, and preferences." />
      {subscriptionSuccess ? (
        <div style={{
          margin: '0 32px 12px',
          padding: '13px 18px',
          borderRadius: 10,
          background: 'rgba(16,185,129,.12)',
          border: '1px solid #b6eecb',
          display: 'flex', minWidth: 0,
          alignItems: 'center',
          gap: 12,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--green-text)',
        }}>
          🎉{' '}
          {upgradedPlan ? (
            <span>
              You&apos;re now on{' '}
              <strong style={{ textTransform: 'capitalize' }}>{upgradedPlan}</strong>!
              Your plan is active.
            </span>
          ) : (
            <span>Subscription activated! Your plan is now live.</span>
          )}
        </div>
      ) : null}
      <div style={{ padding: '0 32px' }}>
        <PlanFeaturesCard entitlements={entitlements} activeCampaigns={campaignsCount} />
        {/* The item list is server-rendered from the caller's OWN persona
            navigation, so the control can only ever reorder or hide what the
            role already grants — it cannot be used to surface another route. */}
        <NavigationPreferences items={navItems} />
      </div>
      <SettingsClient
        initialProfile={profile}
        campaignsCount={campaignsCount}
        userEmail={user.email ?? ''}
        userId={user.id}
        hasStripeCustomer={!!profile.stripe_customer_id}
      />
    </CharitMeShell>
  );
}
