import type { Metadata } from 'next';
import Link from 'next/link';
import { FOOTER_SECTIONS } from '../../lib/footer-nav';

export const metadata: Metadata = {
  title: 'Legal',
  description: 'Every CharitMe policy in one place — terms, privacy, fees, refunds, security and acceptable use.',
  alternates: { canonical: 'https://www.charitme.com/legal' },
};

// The footer's "Legal" link needs a real destination, and the policies were
// previously reachable only by scanning the footer column. This hub is that
// destination, and it is generated from the same FOOTER_SECTIONS source the
// footer renders — so a policy added to the footer appears here automatically
// instead of this page quietly going stale.
const DESCRIPTIONS: Record<string, string> = {
  '/terms': 'The agreement between you and CharitMe when you use the platform.',
  '/privacy': 'What personal data we collect, why, and how long we keep it.',
  '/privacy-center': 'Exercise your data rights — access, export, correction and deletion.',
  '/cookies': 'The cookies we set, what each one does, and how to turn them off.',
  '/accessibility': 'Our WCAG 2.2 AA commitment, known gaps, and how to report a barrier.',
  '/fees': 'What CharitMe charges, and what payment processing costs.',
  '/refunds': 'When a donation can be refunded and how to request one.',
  '/security': 'How funds, accounts and data are protected.',
  '/prohibited-use': 'Campaigns and activities that are not permitted.',
  '/transparency': 'Platform-wide reporting on funds raised, fees and payouts.',
};

const EXTRA_LINKS = [
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Notice', href: '/privacy' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'Accessibility Statement', href: '/accessibility' },
];

export default function LegalPage() {
  // The Legal column minus nothing — this page is the one place that shows the
  // full set, including the policies the footer promotes to its bottom bar.
  const byHref = new Map<string, { label: string; href: string }>();
  for (const link of [...FOOTER_SECTIONS.Legal, ...EXTRA_LINKS]) byHref.set(link.href, link);
  const policies = [...byHref.values()];

  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Legal</b></div>
        <h1>Legal</h1>
        <p>Every CharitMe policy, in one place.</p>
      </section>

      <article className="legal-body">
        <ul className="legal-index">
          {policies.map((policy) => (
            <li key={policy.href}>
              <Link href={policy.href}>{policy.label}</Link>
              {DESCRIPTIONS[policy.href] && <span>{DESCRIPTIONS[policy.href]}</span>}
            </li>
          ))}
        </ul>

        <h2>Questions</h2>
        <p>
          Write to <a href="mailto:legal@charitme.com">legal@charitme.com</a> for anything
          on this page, or use the <Link href="/contact">contact form</Link>.
        </p>
      </article>
    </div>
  );
}
