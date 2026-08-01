import 'server-only';
import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';

/**
 * Custom domain ownership verification (design #150).
 *
 * The only claim this module makes is "a DNS resolver returned our token for
 * this domain, just now". It deliberately cannot express anything weaker — there
 * is no manual override and no optimistic success — because a `verified` flag
 * that a human can set is a statement about the outside world that nothing
 * checked.
 */

export const TXT_PREFIX = '_charitme-verify';

export function generateVerificationToken(): string {
  return `charitme-verify-${randomBytes(16).toString('hex')}`;
}

/**
 * Normalises user input to a bare hostname.
 *
 * Accepts what people actually paste — `https://www.example.com/`, trailing
 * dots, mixed case — and rejects anything that is not a plain public hostname.
 * The value is later interpolated into a DNS query, so it must never carry a
 * scheme, path, port or whitespace.
 */
export function normalizeDomain(raw: string): { ok: true; domain: string } | { ok: false; reason: string } {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/\/.*$/, '');
  value = value.replace(/\.$/, '');

  if (!value) return { ok: false, reason: 'Enter a domain.' };
  if (value.includes('@')) return { ok: false, reason: 'That looks like an email address, not a domain.' };
  if (value.includes(':')) return { ok: false, reason: 'Leave off the port number.' };

  // Labels: letters, digits, hyphens; no leading/trailing hyphen. At least two
  // labels, so `localhost` and single-label internal names cannot be claimed.
  const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  const labels = value.split('.');
  if (labels.length < 2) return { ok: false, reason: 'Use a full domain, like example.com.' };
  if (value.length > 253) return { ok: false, reason: 'That domain is too long.' };
  if (!labels.every((l) => labelPattern.test(l))) {
    return { ok: false, reason: 'That is not a valid domain name.' };
  }
  // A bare IP is not a domain and would point verification at an address rather
  // than a name.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) return { ok: false, reason: 'Enter a domain name, not an IP address.' };

  return { ok: true, domain: value };
}

export type VerificationOutcome =
  | { verified: true }
  | { verified: false; reason: string };

/**
 * Performs the live DNS check.
 *
 * A lookup failure is reported as NOT verified with the reason — never as
 * verified, and never as a hard error that leaves the caller guessing. The three
 * outcomes a caller cares about are: the token is there, it is not there yet, or
 * we could not ask.
 */
export async function verifyDomainOwnership(
  domain: string,
  token: string,
  resolver: (host: string) => Promise<string[][]> = dns.resolveTxt,
): Promise<VerificationOutcome> {
  const host = `${TXT_PREFIX}.${domain}`;
  try {
    const records = await resolver(host);
    // Each TXT record arrives as chunks that must be joined before comparison —
    // resolvers split strings over 255 bytes, and a token compared per-chunk
    // would fail against a correctly configured record.
    const values = records.map((chunks) => chunks.join(''));
    if (values.includes(token)) return { verified: true };
    return {
      verified: false,
      reason: values.length
        ? `Found a TXT record at ${host}, but it does not match the token yet. DNS changes can take time to propagate.`
        : `No TXT record found at ${host}.`,
    };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return { verified: false, reason: `No TXT record found at ${host} yet.` };
    }
    return {
      verified: false,
      reason: `Could not check DNS for ${host} (${code ?? 'lookup failed'}). This is a problem reading DNS, not proof the record is missing.`,
    };
  }
}
