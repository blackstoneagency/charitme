import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Accessibility Statement',
  description: 'CharitMe targets WCAG 2.2 Level AA. What we have verified, what is still open, and how to report a barrier.',
  alternates: { canonical: 'https://www.charitme.com/accessibility' },
};

export default function AccessibilityPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Accessibility Statement</b></div>
        <h1>Accessibility Statement</h1>
        <p>Last updated: July 2026</p>
        <p>
          CharitMe is built to meet <b>WCAG 2.2 Level AA</b>. Fundraising is often
          most urgent for the people most likely to be shut out by an inaccessible
          interface, so we treat accessibility defects as functional defects.
        </p>
      </section>

      <article className="legal-body">
        <h2>What we verify, and how</h2>
        <p>
          These checks run against the public site and are part of the build, not
          a one-off audit:
        </p>
        <ul>
          <li><b>Automated rule checks</b> — axe-core (WCAG 2.0/2.1 A and AA, plus best-practice rules) across every public route, in both light and dark themes, on desktop and mobile viewports.</li>
          <li><b>Measured colour contrast</b> — a browser sweep that reads the <i>computed</i> colour of every visible text node against its resolved background, including translucent layers and gradient stops. Normal text is held to 4.5:1 and large text to 3:1.</li>
          <li><b>Keyboard operation</b> — a skip link as the first focus stop on every page, a visible focus indicator on every interactive control, and no keyboard traps.</li>
          <li><b>Reduced motion</b> — animation and transition are removed when your system requests it.</li>
          <li><b>Responsive layout</b> — no horizontal scrolling or clipped content from 320px upward.</li>
        </ul>

        <h2>Known limitations</h2>
        <p>
          We would rather name these than imply the site is flawless:
        </p>
        <ul>
          <li>Campaign media is supplied by fundraisers. We require alternative text at upload, but we cannot guarantee the quality of a description someone else wrote.</li>
          <li>Embedded third-party content — payment forms and video players — is only as accessible as its provider.</li>
          <li>Automated checks cannot confirm that reading order, labels and error messages actually make sense. Those are reviewed by hand, which means they are sampled rather than exhaustive.</li>
        </ul>

        <h2>Report a barrier</h2>
        <p>
          If any part of CharitMe blocks you, tell us and we will treat it as a
          defect. Email <a href="mailto:accessibility@charitme.com">accessibility@charitme.com</a> or
          use the <Link href="/contact">contact form</Link>. Please include the page
          address and the assistive technology you use, if any.
        </p>
        <p>
          We aim to acknowledge within <b>2 business days</b> and to give you a fix
          or a workaround within <b>10 business days</b>.
        </p>

        <h2>Related</h2>
        <ul>
          <li><Link href="/legal">All legal policies</Link></li>
          <li><Link href="/privacy">Privacy Notice</Link></li>
          <li><Link href="/cookies">Cookie Policy</Link></li>
        </ul>
      </article>
    </div>
  );
}
