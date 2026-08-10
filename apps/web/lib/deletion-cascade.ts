/**
 * What actually gets deleted when one account is deleted — computed from the
 * schema, not from anyone's memory of it.
 *
 * Deleting `auth.users` cascades to `profiles`, and 47 tables cascade from
 * `profiles`. Following that transitively reaches **87 tables**, six of which
 * hold money. Nobody was going to get that list right by reading the schema, and
 * the four non-obvious ones are exactly the dangerous kind:
 *
 *   creator_profiles  -> digital_products -> product_orders
 *   creator_profiles  -> membership_tiers -> member_subscriptions
 *   nonprofit_profiles-> tax_receipts
 *   campaigns         -> fundraising_events -> event_tickets, auction_bids
 *
 * So the reassignment set is DERIVED here and asserted by
 * `__tests__/deletion-cascade.test.ts`. If a future migration adds a foreign key
 * that opens a seventh path to money, that test fails — rather than a deletion
 * quietly taking a new table's rows with it.
 */

/** One foreign key, as written in the schema. */
export interface ForeignKey {
  child: string;
  column: string;
  parent: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

const FK_PATTERN =
  /ALTER TABLE ONLY (?:public|auth)\.(\w+)[\s\S]{0,200}?ADD CONSTRAINT \w+ FOREIGN KEY \((\w+)\) REFERENCES (?:public|auth)\.(\w+)\(\w+\)(?:\s+ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION))?/g;

export function parseForeignKeys(schemaSql: string): ForeignKey[] {
  const keys: ForeignKey[] = [];
  for (const match of schemaSql.matchAll(FK_PATTERN)) {
    keys.push({
      child: match[1],
      column: match[2],
      parent: match[3],
      // PostgreSQL's default when the clause is absent.
      onDelete: (match[4] as ForeignKey['onDelete']) ?? 'NO ACTION',
    });
  }
  return keys;
}

/**
 * Every table that loses rows when one row of `from` is deleted, with the path
 * that reaches it. Only CASCADE edges propagate — SET NULL keeps the row.
 */
export function cascadeClosure(keys: ForeignKey[], from: string): Map<string, string[]> {
  const cascading = keys.filter((k) => k.onDelete === 'CASCADE');
  const reached = new Map<string, string[]>([[from, []]]);
  let frontier = [from];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const table of frontier) {
      for (const key of cascading.filter((k) => k.parent === table)) {
        if (reached.has(key.child)) continue;
        reached.set(key.child, [...(reached.get(table) ?? []), `${key.child}.${key.column}`]);
        next.push(key.child);
      }
    }
    frontier = next;
  }
  return reached;
}

/**
 * Tables whose rows record money that moved, or an obligation to someone else.
 *
 * ⚠️ Deliberately broad. The cost of listing a table that turns out to be
 * harmless is one extra reassignment; the cost of omitting one is deleting
 * somebody's payment record. `donations` alone would have missed
 * `product_orders`, `tax_receipts` and `event_tickets`.
 */
export const MONEY_BEARING = [
  'donations',
  'donation_receipts',
  'refunds',
  'recurring_donations',
  'payouts',
  'subscriptions',
  'matching_claims',
  'tax_receipts',
  'transparency_ledger_items',
  'product_orders',
  'creator_tips',
  'member_subscriptions',
  'commission_requests',
  'auction_bids',
  'event_tickets',
] as const;

/**
 * The first hop out of `profiles` on each path that reaches money — i.e. exactly
 * the columns that must be reassigned to the tombstone before the account is
 * deleted. Reassigning the root severs every path below it at once.
 */
export function moneyBearingRoots(keys: ForeignKey[]): string[] {
  const reached = cascadeClosure(keys, 'profiles');
  const roots = new Set<string>();
  for (const table of MONEY_BEARING) {
    const path = reached.get(table);
    if (path && path.length > 0) roots.add(path[0]);
  }
  return [...roots].sort();
}

/**
 * The tombstone profile from `20260904000000_deleted_user_tombstone.sql`.
 * Not a real account: no usable password, unconfirmed email, banned forever.
 */
export const TOMBSTONE_PROFILE_ID = '00000000-0000-4000-8000-0000deadbeef';

/**
 * The reassignments the deletion performs, as `table.column` pairs.
 *
 * Kept as data rather than as a sequence of update calls so the test can compare
 * it against the computed roots. A hand-written list of updates could not be
 * checked against anything.
 */
export const TOMBSTONE_REASSIGNMENTS: readonly { table: string; column: string }[] = [
  { table: 'campaigns', column: 'user_id' },
  { table: 'creator_profiles', column: 'user_id' },
  { table: 'matching_claims', column: 'employee_id' },
  { table: 'nonprofit_profiles', column: 'owner_id' },
  { table: 'payouts', column: 'user_id' },
  { table: 'subscriptions', column: 'user_id' },
];
