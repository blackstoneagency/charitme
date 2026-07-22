// ─────────────────────────────────────────────────────────────────────────────
// Nonprofit registration & verification — pure, unit-testable core.
//
// Server-side EIN (US Employer Identification Number) validation/normalization
// for the nonprofit onboarding + admin routes (CHAR-1001 security requirement),
// plus the verification status machine (CHAR-1002). No I/O — the API routes call
// these and persist the result.
// ─────────────────────────────────────────────────────────────────────────────

// IRS campus prefixes (first two EIN digits) that have never been assigned.
// A well-formed 9-digit number using one of these is not a real EIN.
// Source: IRS "How EINs are Assigned and Valid EIN Prefixes".
export const INVALID_EIN_PREFIXES: readonly string[] = [
  '00', '07', '08', '09', '17', '18', '19', '28', '29', '49', '78', '79', '89',
];

/** Strip an EIN down to its digits. */
function einDigits(raw: string): string {
  return (raw ?? '').replace(/\D/g, '');
}

/**
 * Validate a US EIN. Accepts common inputs ("12-3456789", "123456789",
 * " 12 3456789 "). Requires exactly 9 digits, a non-zero prefix that is an
 * assigned IRS campus prefix, and not an all-zero body.
 */
export function isValidEin(raw: string): boolean {
  const d = einDigits(raw);
  if (d.length !== 9) return false;
  if (/^0{9}$/.test(d)) return false;
  const prefix = d.slice(0, 2);
  if (INVALID_EIN_PREFIXES.includes(prefix)) return false;
  return true;
}

/**
 * Normalize a valid EIN to the canonical "XX-XXXXXXX" form. Returns null when
 * the input is not a valid EIN, so callers can reject rather than store junk.
 */
export function normalizeEin(raw: string): string | null {
  if (!isValidEin(raw)) return null;
  const d = einDigits(raw);
  return `${d.slice(0, 2)}-${d.slice(2)}`;
}

// ── Verification status machine (CHAR-1002) ──────────────────────────────────
export type NonprofitVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export const NONPROFIT_VERIFICATION_STATUSES: readonly NonprofitVerificationStatus[] = [
  'unverified', 'pending', 'verified', 'rejected',
];

// Allowed transitions. An org submits docs (unverified/rejected → pending); an
// admin decides (pending → verified/rejected); verification can be revoked
// (verified → pending/rejected). A terminal-but-reopenable model — nothing is
// permanently locked, but you cannot skip review to jump straight to verified.
const ALLOWED_TRANSITIONS: Record<NonprofitVerificationStatus, NonprofitVerificationStatus[]> = {
  unverified: ['pending'],
  pending: ['verified', 'rejected'],
  rejected: ['pending'],
  verified: ['pending', 'rejected'],
};

export function canTransitionVerification(
  from: NonprofitVerificationStatus,
  to: NonprofitVerificationStatus,
): boolean {
  if (from === to) return true; // idempotent no-op
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
