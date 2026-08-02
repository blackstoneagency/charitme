import AuthPanel from '../../components/AuthPanel';

// Design 14. The whole panel — Google/Apple OAuth, email+password, the PKCE
// cookie flow, error handling — lives in `components/AuthPanel.tsx` so that
// /login and /signup are two doors into ONE implementation. Duplicating it
// would mean an auth fix landing on one route and not the other, which is the
// class of bug you discover from a support ticket rather than a test.
//
// `?mode=signup` still works here: existing links to /login?mode=signup are
// unchanged, and the URL parameter takes precedence over the route's default.
export default function LoginPage() {
  return <AuthPanel defaultMode="login" />;
}
