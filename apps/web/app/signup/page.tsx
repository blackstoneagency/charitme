import type { Metadata } from 'next';
import AuthPanel from '../../components/AuthPanel';

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Create a free CharitMe account to donate to causes you care about, start a fundraiser, and track your impact in one place.',
  alternates: { canonical: 'https://www.charitme.com/signup' },
};

// Design 13. Until now "sign up" was a MODE TOGGLE on /login, reachable only as
// /login?mode=signup — so the single most important conversion step on the site
// had no URL of its own. That meant no canonical, no distinct title, nothing to
// link a campaign or an ad to, and a "Create Account" call to action that landed
// on a page headed "Log in".
//
// This is a real route with its own metadata. It renders the SAME AuthPanel as
// /login rather than a second copy of the auth logic, so the OAuth and
// email+password paths cannot drift apart between the two pages.
//
// The design's four benefit bullets are the marketing column. They are the
// honest set — each one names something the account actually does today.
const BENEFITS = [
  'Donate to causes you care about',
  'Start your own fundraising campaign',
  'Track your impact in one place',
  'Join a community making a difference',
] as const;

export default function SignupPage() {
  return <AuthPanel defaultMode="signup" benefits={BENEFITS} />;
}
