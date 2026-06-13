// ─────────────────────────────────────────────────────────────────────────────
// Heuristic email validation for the Marketing → Outreach pipeline.
//
// Pure + dependency-free so it can be unit-tested. The API route layers a
// best-effort DNS MX lookup on top of this (see outreach/route.ts) — that part
// needs the Node runtime and so is kept out of this module.
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailValidation {
  email: string;          // normalized (trimmed + lowercased)
  valid: boolean;         // safe to send a 1:1 outreach to
  score: number;          // 0-100 confidence
  syntaxOk: boolean;
  disposable: boolean;    // throwaway / temp-mail domain
  roleBased: boolean;     // info@, support@, sales@ … (low personal-reply odds)
  freeProvider: boolean;  // gmail/yahoo/etc — fine, just informational
  suggestion: string | null; // typo fix, e.g. "gmial.com" → "gmail.com"
  domain: string | null;
  reasons: string[];      // human-readable notes for the admin
}

// Reasonable RFC-5322-ish check — intentionally pragmatic, not exhaustive.
const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', '10minutemail.com',
  'tempmail.com', 'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'trashmail.com',
  'getnada.com', 'dispostable.com', 'fakeinbox.com', 'sharklasers.com', 'maildrop.cc',
  'mailnesia.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'spam4.me',
]);

const ROLE_LOCAL_PARTS = new Set([
  'info', 'admin', 'administrator', 'support', 'sales', 'contact', 'help', 'hello',
  'office', 'billing', 'accounts', 'noreply', 'no-reply', 'donotreply', 'webmaster',
  'postmaster', 'marketing', 'team', 'enquiries', 'inquiries', 'service',
]);

const FREE_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com',
]);

// Common typos → the domain the user almost certainly meant.
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gnail.com': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'iclod.com': 'icloud.com',
};

/**
 * Validate an email address with cheap, deterministic heuristics. `valid` is
 * true when the syntax is good and the domain is not a disposable one; role-based
 * and free-provider addresses are still "valid" but flagged so the admin can
 * decide. Returns a 0-100 confidence score for sorting/triage.
 */
export function validateEmailAddress(raw: string): EmailValidation {
  const email = (raw ?? '').trim().toLowerCase();
  const reasons: string[] = [];

  const syntaxOk = EMAIL_RE.test(email) && email.length <= 254;
  const domain = syntaxOk ? email.slice(email.indexOf('@') + 1) : null;
  const local = syntaxOk ? email.slice(0, email.indexOf('@')) : null;

  if (!syntaxOk) {
    reasons.push('Address does not look like a valid email');
    return {
      email, valid: false, score: 0, syntaxOk: false, disposable: false,
      roleBased: false, freeProvider: false, suggestion: null, domain, reasons,
    };
  }

  const disposable = domain ? DISPOSABLE_DOMAINS.has(domain) : false;
  const roleBased = local ? ROLE_LOCAL_PARTS.has(local) : false;
  const freeProvider = domain ? FREE_PROVIDERS.has(domain) : false;
  const suggestion = domain && DOMAIN_TYPOS[domain]
    ? `${local}@${DOMAIN_TYPOS[domain]}`
    : null;

  let score = 100;
  if (disposable) { score -= 70; reasons.push('Disposable / temporary-mail domain'); }
  if (roleBased) { score -= 25; reasons.push('Role-based inbox (low odds of a personal reply)'); }
  if (suggestion) { score -= 20; reasons.push(`Possible typo — did you mean ${suggestion}?`); }
  if (freeProvider) reasons.push('Personal free-mail provider');
  if (reasons.length === 0) reasons.push('Looks deliverable');

  score = Math.max(0, Math.min(100, score));
  // Disposable is the one hard fail for outreach; everything else is a soft flag.
  const valid = syntaxOk && !disposable;

  return { email, valid, score, syntaxOk, disposable, roleBased, freeProvider, suggestion, domain, reasons };
}
