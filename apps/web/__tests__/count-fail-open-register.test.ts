import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const read = (p: string) => strip(readFileSync(join(WEB_ROOT, p), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// The `count ?? 0` register — closing out the fail-open class.
//
// supabase-js RESOLVES rather than throws on a query error, so `count` is null
// whenever a query fails. `count ?? 0` therefore turns "we could not read this"
// into a confident zero. Seven of these were fixed earlier as safety-bearing
// (privacy filter, entitlements, trust score, system health, support queue,
// notification badge). These are the remaining display sites, where zero is
// still the reassuring answer an operator would act on.
//
// A `?? 0` is only acceptable when an explicit unknown flag governs what the
// user sees — those are asserted here, not banned.
// ─────────────────────────────────────────────────────────────────────────────

describe('the system page cannot invent a healthy reading', () => {
  const page = read('app/admin/system/page.tsx');

  it('countOf returns unknown rather than zero on error', () => {
    expect(page).toMatch(/if \(result\.error\) return null;/);
    expect(page).not.toMatch(/function countOf[\s\S]{0,120}?return result\.count \?\? 0;/);
  });

  it('a sum stays unknown when any part is unknown', () => {
    // Adding a known count to an unknown one used to yield a confident total.
    expect(page).toContain('sumOrNull');
  });

  it('an unread error rate is an em dash, not 0%', () => {
    expect(page).toMatch(/if \(errorCount === null \|\| totalCount === null\) return '—';/);
  });

  it('does not paint the unknown error rate green', () => {
    // `'0%'` drove a green check mark, and an unread count produced exactly '0%'.
    const client = read('app/admin/system/_components/SystemClient.tsx');
    expect(client).toMatch(/overview\.errorRate === '—' \? '#67718e'/);
  });

  it('omits a resource bar whose inputs were not read', () => {
    // percentage() returns its emptyValue of 100 for an empty denominator, so
    // an all-failed read rendered "Webhook Success 100%" out of no data.
    expect(page).toContain('computedResourceUsage');
    expect(page).toMatch(/totalHealthEvents !== null && webhookErrors !== null/);
    // The old shape built the bars inline and unconditionally.
    expect(page).not.toMatch(/\? rpcResourceUsage\s*:\s*\[/);
    expect(page).toMatch(/rpcResourceUsage\.length > 0 \? rpcResourceUsage : computedResourceUsage/);
  });
});

describe('marketing counts are unknown-aware', () => {
  const overview = read('app/admin/marketing/_components/overview.ts');
  const client = read('app/admin/marketing/_components/AdminMarketingClient.tsx');

  it('no longer coerces a failed count to zero', () => {
    for (const field of ['contacts', 'events7d', 'campaignsSent', 'unsubscribed']) {
      expect(overview, field).not.toMatch(new RegExp(`${field}: \\w+Res\\.count \\?\\? 0`));
    }
    expect(overview).toMatch(/r\.error \? null : r\.count/);
  });

  it('renders unknown as an em dash', () => {
    expect(client).toMatch(/value === null \? '—'/);
    expect(client).toMatch(/showCount\(overview\.unsubscribed\)/);
  });
});

describe('admin settings does not claim zero connected integrations', () => {
  it('derives unknown from the error field', () => {
    expect(read('app/admin/settings/page.tsx')).toMatch(
      /Boolean\(integrationCountResult\.error\) \|\| integrationCountResult\.count == null/,
    );
  });

  it('passes null through and renders an em dash', () => {
    expect(read('app/admin/settings/page.tsx')).toContain('integrationsUnknown ? null : integrations');
    expect(read('app/admin/settings/_components/SettingsClient.tsx')).toMatch(
      /overview\.integrations === null \? '—'/,
    );
  });
});

describe('the admin user directory does not report zero users on a failed read', () => {
  const page = read('app/admin/users/page.tsx');

  it('tracks both failure modes separately', () => {
    expect(page).toMatch(/Boolean\(countResult\.error\) \|\| countResult\.count == null/);
    expect(page).toMatch(/Boolean\(newUsersCountResult\.error\) \|\| newUsersCountResult\.count == null/);
  });

  it('treats a failed COUNT alone as enough to make the total unknown', () => {
    // This assertion used to require the row read to have failed too, on the
    // reasoning that "a failed count with rows loaded still yields a real
    // page-limited number". The number is real, but it is LABELLED "total
    // users" and the row query is capped at 2000 — so on a site with more than
    // 2000 profiles a count failure would confidently report exactly
    // "2,000 total users", indefinitely, with no notice shown. Latent rather
    // than live: production holds 1,133 profiles, so the substituted value
    // currently happens to equal the true total.
    expect(page).toMatch(/totalsUnreliable = totalUnknown \|\| new30dUnknown/);
    expect(page).not.toMatch(/&& Boolean\(profileError\)/);
  });

  it('passes null rather than a page-limited substitute', () => {
    expect(page).toMatch(/total:\s+totalUnknown \? null : exactTotal/);
    expect(page).toMatch(/newUsers:\s+new30dUnknown \? null : exactNew30d/);
    expect(page).not.toMatch(/exactTotal > 0 \? exactTotal : users\.length/);
  });

  it('renders the unknown total as an em dash, and no percentage of it', () => {
    const client = read('app/admin/users/_components/AdminUsersClient.tsx');
    expect(client).toMatch(/totals\.total === null \? '—'/);
    expect(client).toMatch(/totals\.newUsers === null \? '—'/);
    // A percentage OF an unknown total is not a number worth printing.
    expect(client).toMatch(/share of total unknown/);
  });

  it('says so instead of printing a total it does not have', () => {
    expect(page).toContain('DegradedReadNotice');
    expect(page).toMatch(/User count unavailable/);
  });
});

describe('the surviving `?? 0` sites are all governed by an unknown flag', () => {
  // These keep `?? 0` only to satisfy a number type; what the operator SEES is
  // decided by the flag. Banning the operator outright would be cargo-culting.
  it('admin dashboard webhook + integration counts', () => {
    const page = read('app/admin/page.tsx');
    expect(page).toMatch(/webhookErrorsUnknown/);
    expect(page).toMatch(/integrationsUnknown/);
  });

  it('support queue counts', () => {
    const page = read('app/admin/support/page.tsx');
    expect(page).toMatch(/resolvedUnknown/);
    expect(page).toMatch(/urgentUnknown/);
    expect(page).toMatch(/show\(urgentUnknown, urgent\)/);
  });
});
