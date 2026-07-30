// ─────────────────────────────────────────────────────────────────────────────
// Who may read a creator's post.
//
// Pure and separate from the route for the same reason `lib/creator-handle.ts`
// is: the route imports `server-only` and cannot be unit-tested, and this is
// access-control code. A mistake here does not throw or 500 — it silently
// publishes paid content. That failure is invisible to typecheck, to lint, to a
// smoke sweep, and to a human reading the page while signed in as the author.
//
// ⚠️ THE CENTRAL RULE: a locked post's `body` must never leave the server.
//
// Not "must not be rendered" — must not be SENT. Rendering a teaser while the
// full body sits in the serialized RSC payload or a JSON response is the classic
// paywall bypass: the reader opens devtools, or view-source, and reads it. So
// gating happens by REDACTING the row (`redactPost`), not by branching in JSX,
// and `lockedPost.body` is typed away entirely so a component cannot render what
// it does not have.
// ─────────────────────────────────────────────────────────────────────────────

export type PostVisibility = 'public' | 'members' | 'tier';

export interface RawPost {
  id: string;
  title: string;
  body: string;
  visibility: PostVisibility;
  minimum_tier_id: string | null;
  created_at: string;
}

/** An active membership held by the viewer, reduced to what gating needs. */
export interface ViewerMembership {
  tierId: string;
  /** Used to compare against a post's `minimum_tier_id` by price, not identity. */
  amountCents: number;
}

/** What the client is allowed to receive. `body` exists only when unlocked. */
export type VisiblePost =
  | { id: string; title: string; visibility: PostVisibility; created_at: string; locked: false; body: string }
  | { id: string; title: string; visibility: PostVisibility; created_at: string; locked: true; lockReason: string };

/**
 * A subscription counts only while `status === 'active'` and the paid period has
 * not lapsed.
 *
 * `past_due` deliberately does NOT count. Patreon-style platforms often grant a
 * grace period, and that may be the right product call later — but the honest
 * default is that access follows payment, and a grace period is a decision to
 * make explicitly rather than something to inherit by writing a looser check.
 * `current_period_end === null` is treated as "no known lapse" so a subscription
 * created before the field is populated is not locked out by a data gap.
 */
export function isMembershipActive(
  sub: { status: string; current_period_end: string | null },
  now: Date = new Date(),
): boolean {
  if (sub.status !== 'active') return false;
  if (sub.current_period_end === null) return true;
  const end = Date.parse(sub.current_period_end);
  if (Number.isNaN(end)) return false; // unparseable date → deny, never grant
  return end >= now.getTime();
}

/**
 * Can this viewer read this post in full?
 *
 * `tierPrices` maps tier id → amount, so a 'tier' post compares by PRICE rather
 * than by tier identity: a member on the $50 tier must be able to read a post
 * gated at $10, and tier ids carry no ordering. A missing price is treated as
 * unsatisfiable rather than free.
 */
export function canRead(
  post: Pick<RawPost, 'visibility' | 'minimum_tier_id'>,
  memberships: readonly ViewerMembership[],
  tierPrices: ReadonlyMap<string, number>,
  isAuthor = false,
): boolean {
  if (isAuthor) return true;
  if (post.visibility === 'public') return true;
  if (memberships.length === 0) return false;
  if (post.visibility === 'members') return true;

  // visibility === 'tier'
  if (!post.minimum_tier_id) {
    // A 'tier' post with no tier named is under-specified. Treat it as
    // members-only rather than public — an unset gate must never open wider
    // than the author asked for.
    return true;
  }
  const required = tierPrices.get(post.minimum_tier_id);
  if (required === undefined) return false;
  return memberships.some((m) => m.amountCents >= required);
}

function lockReasonFor(post: Pick<RawPost, 'visibility' | 'minimum_tier_id'>, tierTitles: ReadonlyMap<string, string>): string {
  if (post.visibility === 'tier' && post.minimum_tier_id) {
    const title = tierTitles.get(post.minimum_tier_id);
    if (title) return `Available to members at the ${title} tier and above`;
  }
  return 'Available to members';
}

/**
 * Reduce a post to what the viewer may receive. This is the ONLY function that
 * should be used to put a post on the wire.
 */
export function redactPost(
  post: RawPost,
  memberships: readonly ViewerMembership[],
  tierPrices: ReadonlyMap<string, number>,
  tierTitles: ReadonlyMap<string, string>,
  isAuthor = false,
): VisiblePost {
  const base = { id: post.id, title: post.title, visibility: post.visibility, created_at: post.created_at };
  if (canRead(post, memberships, tierPrices, isAuthor)) {
    return { ...base, locked: false, body: post.body };
  }
  return { ...base, locked: true, lockReason: lockReasonFor(post, tierTitles) };
}

export function redactPosts(
  posts: readonly RawPost[],
  memberships: readonly ViewerMembership[],
  tierPrices: ReadonlyMap<string, number>,
  tierTitles: ReadonlyMap<string, string>,
  isAuthor = false,
): VisiblePost[] {
  return posts.map((p) => redactPost(p, memberships, tierPrices, tierTitles, isAuthor));
}
