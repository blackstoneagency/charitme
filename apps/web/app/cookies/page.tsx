import type { Metadata } from 'next';
import Link from 'next/link';
import PrivacyPreferences from '../../components/PrivacyPreferences';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'The cookies CharitMe sets, what each one does, and how to change your choices.',
  alternates: { canonical: 'https://www.charitme.com/cookies' },
};

// This page is the target of BOTH footer controls — "Manage Cookie Preferences"
// (#preferences) and "Your Privacy Choices" (#your-privacy-choices).
//
// Neither may point at /privacy-center: that page calls requireUser(), so an
// anonymous visitor clicking a privacy-choice link would be bounced to a login
// wall. A privacy control you must create an account to reach is not a control.
export default function CookiePolicyPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Cookie Policy</b></div>
        <h1>Cookie Policy</h1>
        <p>Last updated: July 2026</p>
        <p>
          CharitMe uses a deliberately small number of cookies. We do not run
          advertising cookies and we do not sell visitor data.
        </p>
      </section>

      <article className="legal-body">
        <h2>What we set</h2>
        {/* The wrapper scrolls horizontally on narrow screens, so it needs to be
            focusable (WCAG 2.1.1): without tabIndex a keyboard-only user can
            reach neither the scrollbar nor the columns it hides. role+aria-label
            give the focus stop a name, so it does not announce as "group".

            Two lint rules genuinely disagree here. jsx-a11y/no-noninteractive-
            tabindex forbids tabIndex on a non-interactive element, and axe's
            scrollable-region-focusable requires it — the latter is the actual
            WCAG success criterion, and axe is measuring the rendered page rather
            than guessing from the source, so it wins. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className="legal-table-wrap" tabIndex={0} role="region" aria-label="Cookies CharitMe sets">
          <table className="legal-table">
            <thead>
              <tr><th>Cookie</th><th>Purpose</th><th>Retention</th><th>Can you refuse it?</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>sb-*-auth-token</code></td>
                <td>Keeps you signed in. Set by Supabase, our authentication provider.</td>
                <td>Session / until sign-out</td>
                <td>No — without it you cannot stay signed in</td>
              </tr>
              <tr>
                <td><code>charitme_locale</code></td>
                <td>Remembers the country and language you chose in the footer.</td>
                <td>1 year</td>
                <td>Yes — the site falls back to your browser language</td>
              </tr>
              <tr>
                <td><code>charitme-theme</code></td>
                <td>Remembers your light or dark mode choice.</td>
                <td>1 year</td>
                <td>Yes — the site follows your system setting instead</td>
              </tr>
              <tr>
                <td><code>__stripe_*</code></td>
                <td>Set by Stripe during checkout for fraud prevention.</td>
                <td>Up to 1 year</td>
                <td>No — required to process a payment</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          We use first-party analytics to see which pages and campaigns are
          useful. It records page views, not identities, and is not shared with
          advertisers.
        </p>

        <h2 id="preferences">Manage cookie preferences</h2>
        <p>
          Strictly necessary cookies — the ones that sign you in and take a
          payment — cannot be switched off, because the site cannot do those
          things without them. Everything else is below.
        </p>
        <PrivacyPreferences />

        <h2 id="your-privacy-choices">Your privacy choices</h2>
        <p>
          Some US state privacy laws give you the right to opt out of the sale or
          sharing of personal information, and of targeted advertising.
        </p>
        <p>
          <b>CharitMe does not sell or share personal information, and does not
          run targeted advertising.</b> There is accordingly nothing to opt out
          of. The control above still lets you turn off first-party analytics,
          and it takes effect immediately in this browser.
        </p>
        <p>
          To exercise access, correction, portability or deletion rights, use
          the <Link href="/privacy-center">Privacy Center</Link> once signed in,
          or email <a href="mailto:privacy@charitme.com">privacy@charitme.com</a> —
          you do not need an account to make a request by email.
        </p>

        <h2>Changing your browser settings</h2>
        <p>
          Every major browser lets you block or delete cookies. Blocking all
          cookies will sign you out and will prevent checkout from completing.
        </p>

        <h2>Related</h2>
        <ul>
          <li><Link href="/privacy">Privacy Notice</Link></li>
          <li><Link href="/legal">All legal policies</Link></li>
          <li><Link href="/accessibility">Accessibility Statement</Link></li>
        </ul>
      </article>
    </div>
  );
}
