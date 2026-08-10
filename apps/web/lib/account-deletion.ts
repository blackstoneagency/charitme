/**
 * Self-service account deletion — App Store Guideline 5.1.1(v).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ READ THIS BEFORE CHANGING ANYTHING HERE. THE OBVIOUS IMPLEMENTATION
 *    DESTROYS OTHER PEOPLE'S DONATION RECORDS, SILENTLY AND IRREVERSIBLY.
 *
 * The natural way to delete an account is
 * `supabaseAdmin.auth.admin.deleteUser(id)`. Traced through the schema's real
 * foreign keys, that one call cascades:
 *
 *     auth.users            DELETE
 *       └─ profiles.id             ON DELETE CASCADE   (profile row goes)
 *           └─ campaigns.user_id   ON DELETE CASCADE   (every campaign goes)
 *               └─ donations.campaign_id ON DELETE CASCADE
 *                                        (EVERY DONATION TO THEM GOES)
 *
 * Those donations are other people's financial records. They are the money
 * that moved through Stripe, the receipts issued, and the figures every public
 * total on the site is computed from. Deleting one fundraiser's account would
 * quietly erase the giving history of every donor who ever supported them, and
 * nothing would report it — the delete succeeds, the page still renders, and
 * the totals are simply smaller than they were.
 *
 * It also directly contradicts what `/privacy-center` promises in its own copy:
 * "records of completed transactions are retained but no longer linked to your
 * identity".
 *
 * `donations.donor_id` is `ON DELETE SET NULL`, so donations the user MADE are
 * safe. The hazard is entirely in donations they RECEIVED.
 *
 * So this module's rule is: **anonymise the identity, never cascade the
 * records** — and when the two cannot be separated, REFUSE and say why rather
 * than delete and hope.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Why a deletion could not be completed. Each maps to a specific user message. */
export type DeletionRefusal = 'DISABLED' | 'ACCOUNT_HAS_DONATIONS' | 'NOT_CONFIRMED';

/**
 * Off unless explicitly switched on.
 *
 * `master` deploys straight to production, so an irreversible self-service
 * delete must not arrive as a side effect of a merge. The flag is what makes
 * the code shippable without arming it: the endpoint 404s and the UI keeps the
 * existing review-queue flow until an operator opts in.
 */
export function accountSelfDeleteEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ACCOUNT_SELF_DELETE_ENABLED === 'true';
}

/**
 * The exact phrase the client must send back.
 *
 * Typed confirmation, not a boolean. `{ confirm: true }` is one stray fetch or
 * one replayed request away from deleting an account, and this operation has no
 * undo.
 */
export const DELETION_CONFIRMATION = 'DELETE MY ACCOUNT';

export function isConfirmed(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === DELETION_CONFIRMATION;
}

export interface DeletionPreconditions {
  /** Donations RECEIVED by campaigns this account owns. */
  donationsReceived: number | null;
}

/**
 * Can this account be deleted without taking financial records with it?
 *
 * ⚠️ `null` means the count could not be READ, and it refuses. An unknown
 * number of donations is not zero donations — treating it as zero is precisely
 * the mistake that would cascade. This is the same fail-closed rule the
 * ownership read follows for authorization.
 */
export function refusalFor(
  pre: DeletionPreconditions,
  opts: { enabled: boolean; confirmed: boolean },
): DeletionRefusal | null {
  if (!opts.enabled) return 'DISABLED';
  if (!opts.confirmed) return 'NOT_CONFIRMED';
  if (pre.donationsReceived === null || pre.donationsReceived > 0) return 'ACCOUNT_HAS_DONATIONS';
  return null;
}

/** What the user is told, and what they can do about it. */
export function refusalMessage(refusal: DeletionRefusal): string {
  switch (refusal) {
    case 'DISABLED':
      return 'Self-service deletion is not enabled.';
    case 'NOT_CONFIRMED':
      return `Type "${DELETION_CONFIRMATION}" to confirm.`;
    case 'ACCOUNT_HAS_DONATIONS':
      // Deliberately explains the reason. "Something went wrong" here would send
      // the user to support with no idea what to say, for a refusal that is
      // permanent until their campaigns are settled.
      return 'Your campaigns have received donations, which are financial records we must keep. Contact support to close your account so those records stay intact and unlinked from you.';
  }
}
