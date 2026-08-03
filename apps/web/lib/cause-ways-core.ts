/**
 * "Ways to help" for a cause — pure link model.
 *
 * The reference artwork shows this block on every cause page: Donate, Start a
 * Fundraiser, Volunteer, Corporate Partnership. The cause landing had no such
 * section — its `cl-ways` block is "other causes", which is a different thing
 * wearing a similar name.
 *
 * ⚠️ **The `scoped` flag is the point of this module.** Only `/campaigns` accepts
 * a category filter; `/volunteer`, `/events`, `/partner` and `/create` take no
 * search params at all, so a link to them is site-wide however it is labelled.
 * Marking which links genuinely narrow to the cause stops the UI promising
 * "Sports & Youth volunteering" and delivering the whole volunteer list — the
 * difference between a filtered view and one that merely looks filtered.
 */

export type CauseWay = {
  id: string;
  label: string;
  blurb: string;
  href: string;
  /** True only when the destination really filters to this cause. */
  scoped: boolean;
};

/**
 * Shape this module needs. Deliberately looser than `Cause`, whose `categories`
 * is a branded union: nothing here depends on the union, and requiring it would
 * mean the encoding path could only ever be tested with values that never need
 * encoding.
 */
export type CauseLike = { label: string; categories: readonly string[] };

/**
 * A cause's primary category — the one `/campaigns?category=` is keyed on.
 *
 * `null` when the cause declares none, in which case the donate link must fall
 * back to the unfiltered list rather than emitting `?category=` with nothing
 * after it, which would render an empty grid that looks like "no campaigns".
 */
export function primaryCategory(cause: Pick<CauseLike, 'categories'>): string | null {
  const first = cause.categories?.[0]?.trim();
  return first ? first : null;
}

export function campaignsHref(cause: Pick<CauseLike, 'categories'>): string {
  const category = primaryCategory(cause);
  return category ? `/campaigns?category=${encodeURIComponent(category)}` : '/campaigns';
}

export function causeWays(cause: CauseLike): CauseWay[] {
  const category = primaryCategory(cause);
  return [
    {
      id: 'donate',
      label: 'Donate to a campaign',
      blurb: category
        ? `Give directly to a live ${cause.label} campaign. The platform takes 0%.`
        : `Give directly to a live campaign. The platform takes 0%.`,
      href: campaignsHref(cause),
      scoped: category !== null,
    },
    {
      id: 'fundraise',
      label: 'Start a fundraiser',
      blurb: 'Raise for something you care about. Setting one up takes a few minutes.',
      href: '/create',
      scoped: false,
    },
    {
      id: 'volunteer',
      label: 'Volunteer your time',
      blurb: 'Give hours instead of money. Opportunities are listed across every cause.',
      href: '/volunteer',
      scoped: false,
    },
    {
      id: 'events',
      label: 'Join an event',
      blurb: 'Fundraising events and sessions you can attend or host.',
      href: '/events',
      scoped: false,
    },
    {
      id: 'partner',
      label: 'Partner with us',
      blurb: 'Workplace giving, matching, and sponsorship for companies and organisations.',
      href: '/partner',
      scoped: false,
    },
  ];
}

/**
 * The note shown under the block when some links are site-wide.
 *
 * Returns `null` when every link is scoped, so the disclosure appears only when
 * it is actually needed rather than as permanent boilerplate nobody reads.
 */
export function scopeDisclosure(ways: readonly CauseWay[], causeLabel: string): string | null {
  const general = ways.filter((w) => !w.scoped);
  if (general.length === 0) return null;
  return `Only the campaign link narrows to ${causeLabel}. The others cover every cause — we would rather say so than imply a filter that is not there.`;
}
