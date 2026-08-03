import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const WEB_ROOT = path.join(__dirname, '..');
const read = (p: string) => readFileSync(path.join(WEB_ROOT, p), 'utf8');

const PAGE = read('app/donate/page.tsx');
const FORM = read('app/donate/DonateForm.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// /donate is the page that asks people for money, so the properties worth
// pinning are the ones whose failure costs the most: charging the wrong amount,
// charging twice, inventing a number, or naming a donor who asked to be hidden.
// ─────────────────────────────────────────────────────────────────────────────

describe('the donate panel does not re-implement the money path', () => {
  it('posts to the same endpoints as the campaign-page flow', () => {
    expect(FORM).toContain("'/api/donations/recurring'");
    expect(FORM).toContain("'/api/donations'");
  });

  it('sends an Idempotency-Key on one-off donations', () => {
    // Without it a double-click or a retried request can charge twice. Recurring
    // is excluded deliberately — it has its own guard server-side.
    expect(FORM).toMatch(/Idempotency-Key/);
    expect(FORM).toMatch(/monthly \? \{\} : \{ 'Idempotency-Key'/);
  });

  it('reuses the shared donation floor rather than hardcoding one', () => {
    expect(FORM).toContain("from '@shared/fees'");
    expect(FORM).toContain('MIN_DONATION_CENTS');
    expect(FORM).toContain('MAX_DONATION_CENTS');
    // A literal minimum here would drift from the server's the first time either
    // moved, and the donor would see a limit the API does not enforce.
    expect(FORM).not.toMatch(/amountCents\s*<\s*\d{2,}/);
  });

  it('builds the charge from the selected amount, in cents', () => {
    expect(FORM).toMatch(/Math\.round\(parsed \* 100\)/);
    expect(FORM).toMatch(/body: JSON\.stringify\(\{[\s\S]*?amountCents/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Native constraint validation short-circuits the submit handler, so `required`
// on the picker and `min` on the amount made the browser fire a tooltip while
// every other check reported through the styled role="alert" region — two
// validation surfaces on one form, only one of them announced consistently.
// ─────────────────────────────────────────────────────────────────────────────

describe('validation reports through one surface', () => {
  it('the campaign picker is not natively required', () => {
    const select = FORM.slice(FORM.indexOf('<select'), FORM.indexOf('</select>'));
    expect(select).not.toMatch(/\brequired\b/);
  });

  it('the custom amount input carries no min attribute', () => {
    const input = FORM.slice(FORM.indexOf('type="number"'), FORM.indexOf('type="number"') + 400);
    expect(input).not.toMatch(/\bmin=\{/);
  });

  it('every rejection lands in a live region', () => {
    expect(FORM).toMatch(/role="alert"/);
    expect(FORM).toContain('setError(');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Degraded reads. A donation page that renders "0 donations" or an empty picker
// because a query timed out is worse than one that admits it — the numbers here
// are social proof, so a confident zero actively discourages giving.
// ─────────────────────────────────────────────────────────────────────────────

describe('the page degrades honestly', () => {
  it('distinguishes a failed campaign read from an empty one', () => {
    expect(PAGE).toMatch(/Promise<DonateTarget\[\] \| null>/);
    expect(PAGE).toContain('if (error) return null;');
    expect(PAGE).toMatch(/targetsFailed/);
  });

  it('tells the donor when the picker could not load, instead of showing it empty', () => {
    expect(FORM).toContain('loadFailed');
    expect(FORM).toMatch(/couldn&rsquo;t load campaigns|couldn't load campaigns/);
    // And refuses the submit rather than posting an empty campaignId.
    expect(FORM).toMatch(/disabled=\{busy \|\| loadFailed\}/);
  });

  it('never renders a donation count it did not measure', () => {
    expect(PAGE).toMatch(/donationCount === null/);
    // The fallback is a phrase, not a number.
    expect(PAGE).not.toMatch(/donationCount \?\? 0/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Donor anonymity. Naming a donor who asked to be hidden is a defect this repo
// has already fixed several times — on the leaderboard, the donor wall, the
// homepage ticker and the data export. The safe move is to reuse the mapper
// that already honours BOTH gates rather than write a fourth query.
// ─────────────────────────────────────────────────────────────────────────────

describe('supporter quotes cannot re-break donor anonymity', () => {
  it('reuses getRecentDonations instead of querying donations directly', () => {
    expect(PAGE).toContain('getRecentDonations');
    const donationQuery = /from\(\s*['"]donations['"]\s*\)[\s\S]{0,200}?donor_id/;
    expect(
      donationQuery.test(PAGE),
      'the page joins donor identity itself — use getRecentDonations, which honours ' +
        'the per-donation anonymous flag AND the account-wide profile visibility setting',
    ).toBe(false);
  });

  it('only quotes real donations when there are enough of them', () => {
    // Padding three real quotes out with invented ones would put fabricated
    // testimonials on the page that asks for money.
    expect(PAGE).toMatch(/recent\.length >= 3/);
    expect(PAGE).toContain('FALLBACK_QUOTES');
  });
});

describe('the page keeps its Supabase reads bounded', () => {
  it('wraps every query in boundedQuery', () => {
    const froms = PAGE.match(/supabaseAdmin\s*\n?\s*\.from\(/g) ?? [];
    const bounded = PAGE.match(/boundedQuery\(/g) ?? [];
    expect(froms.length).toBeGreaterThan(0);
    expect(bounded.length).toBeGreaterThanOrEqual(froms.length);
  });

  it('shows only campaigns that are live and public', () => {
    expect(PAGE).toContain('applyLiveFilters');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tax status. The supplied design read "CharitMe is a 501(c)(3) nonprofit
// organization. All donations are tax-deductible." The product says the
// opposite in three places a donor actually reaches — the campaign FAQ, the
// donation receipt and the annual tax statement — because CharitMe is the
// PLATFORM and deductibility depends on the recipient.
//
// This is a regulated claim on the page that takes the money, so it is pinned:
// the donate page must not promise a deduction its own receipt then denies.
// ─────────────────────────────────────────────────────────────────────────────
describe('the donate page does not overclaim tax deductibility', () => {
  it('never states that CharitMe itself is a 501(c)(3)', () => {
    expect(FORM).not.toMatch(/CharitMe is a 501\(c\)\(3\)/);
  });

  it('never promises that ALL donations are deductible', () => {
    const copy = FORM.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''); // ignore the rationale comment
    expect(copy).not.toMatch(/All donations are tax-deductible/i);
  });

  it('conditions deductibility on a verified nonprofit, as the receipt does', () => {
    expect(FORM).toMatch(/verified 501\(c\)\(3\)/);
    expect(FORM).toMatch(/not deductible|not tax-deductible/i);
  });

  it('agrees with what the campaign FAQ tells the same donor', () => {
    const faq = readFileSync(path.join(WEB_ROOT, 'app/api/campaigns/[id]/faqs/route.ts'), 'utf8');
    expect(faq).toMatch(/not tax-deductible unless/i);
  });
});
