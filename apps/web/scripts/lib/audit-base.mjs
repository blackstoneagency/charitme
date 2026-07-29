// Shared base-URL resolution for the audit scripts.
//
// These scripts disagreed on how to accept a server URL: audit-contrast,
// audit-web-vitals, audit-responsive, audit-api-auth-live and
// audit-scroll-keyboard took `--base <url>`, while audit-a11y and audit-mobile
// took a bare positional argument. Passing the wrong spelling does not error —
// the script silently falls back to its default port and audits whatever happens
// to be there, or nothing at all.
//
// That has now misfired three times: a documented earlier run, and twice in one
// session (audit-contrast swept port 3000 while the build under test was on 3100
// and printed 80 connection errors; audit-web-vitals reported "nothing usable on
// :3000" while :3101 was serving fine). Each failure was loud, which is the one
// saving grace — but the operator's first guess is always "the server is down",
// and the wrong guess costs a full re-run of a multi-minute sweep.
//
// One resolver, both spellings, everywhere.
export function resolveBase(argv, fallback = 'http://127.0.0.1:3000') {
  const flagIndex = argv.indexOf('--base');
  if (flagIndex !== -1 && argv[flagIndex + 1]) return argv[flagIndex + 1];
  // Positional: match on the URL shape rather than "first non-flag argument".
  // Skipping a flag's value generically breaks on BOOLEAN flags — these scripts
  // have several (--json, --strict-gradients), and `--json http://…` would then
  // swallow the URL as if it were --json's argument.
  const positional = argv.slice(2).find((a) => /^https?:\/\//.test(a));
  return positional ?? fallback;
}
