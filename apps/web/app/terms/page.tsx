import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — CharitMe',
  description: 'The terms that govern your use of the CharitMe fundraising platform.',
};

const LAST_UPDATED = 'May 2025';

export default function TermsPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Terms of Service</b></div>
        <h1>Terms of Service</h1>
        <p style={{ color: 'var(--t3)', fontSize: 14 }}>Last updated: {LAST_UPDATED}</p>
      </section>

      <article className="legal-body">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using CharitMe at charitme.com (&ldquo;the Platform&rdquo;), you agree to these
          Terms of Service. If you do not agree, do not use the Platform.
        </p>

        <h2>2. What CharitMe Does</h2>
        <p>
          CharitMe is a fundraising platform that allows individuals, teams, and nonprofits to create
          campaign pages, accept donations from donors, and receive payouts through Stripe Connect.
          CharitMe is a technology platform — it is not a charity, foundation, or financial institution.
          CharitMe does not verify the truth of campaign claims, guarantee fundraising outcomes, or
          provide tax-deduction status except where a verified 501(c)(3) nonprofit is confirmed.
        </p>

        <h2>3. User Accounts</h2>
        <p>You must be at least 18 years old to create an account and start a campaign. You are responsible for maintaining the security of your account credentials.</p>

        <h2>4. Organizer Responsibilities</h2>
        <ul>
          <li>All campaign information must be accurate and truthful</li>
          <li>You must use donated funds for the stated purpose</li>
          <li>You must post updates when material campaign conditions change</li>
          <li>You must not create campaigns for prohibited purposes (illegal activities, hate, violence, adult content, gambling, or fraudulent schemes)</li>
          <li>You are responsible for complying with all applicable laws including tax laws</li>
        </ul>

        <h2>5. Donations</h2>
        <p>
          Donations are voluntary contributions. CharitMe charges 0% mandatory platform fee. Donors may optionally add a support tip to CharitMe at checkout (default 8%, changeable to $0). Stripe charges 2.9% + $0.30 per transaction, which donors may optionally cover.
        </p>
        <p>
          Donations are generally non-refundable except where campaign funds are misused or fraud is confirmed. Contact the organizer first for any refund request.
        </p>

        <h2>6. Payouts</h2>
        <p>
          Campaign organizers receive funds through Stripe Connect. Payouts require identity verification and a connected bank account. CharitMe does not hold funds — donations are held in your Stripe Connect balance until you request a payout.
        </p>

        <h2>7. Prohibited Uses</h2>
        <p>You may not use the Platform to:</p>
        <ul>
          <li>Create fraudulent, deceptive, or misleading campaigns</li>
          <li>Raise funds for illegal activities</li>
          <li>Impersonate another person or organization</li>
          <li>Violate intellectual property rights</li>
          <li>Spam, harass, or harm other users</li>
        </ul>

        <h2>8. Platform Fees</h2>
        <p>CharitMe&rsquo;s free plan charges 0% mandatory platform fee. Paid subscription plans (Starter, Pro) offer additional features. Subscription fees are charged monthly or yearly and are non-refundable after the billing period begins.</p>

        <h2>9. Limitation of Liability</h2>
        <p>
          CharitMe provides the Platform &ldquo;as is.&rdquo; To the maximum extent permitted by law, CharitMe is not liable for any indirect, incidental, or consequential damages. Our total liability to you shall not exceed the fees you paid to CharitMe in the 12 months preceding the claim.
        </p>

        <h2>10. Governing Law</h2>
        <p>These Terms are governed by the laws of the United States. Disputes shall be resolved by binding arbitration or small claims court.</p>

        <h2>11. Changes</h2>
        <p>We may update these Terms. Continued use of the Platform after changes constitutes acceptance.</p>

        <h2>12. Contact</h2>
        <p>
          Questions? Email <a href="mailto:legal@charitme.com">legal@charitme.com</a>.
        </p>
      </article>
    </div>
  );
}
