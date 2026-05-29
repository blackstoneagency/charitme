import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — KindFund',
  description: 'How KindFund collects, uses, and protects your personal information.',
};

const LAST_UPDATED = 'May 2025';

export default function PrivacyPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Privacy Policy</b></div>
        <h1>Privacy Policy</h1>
        <p style={{ color: 'var(--t3)', fontSize: 14 }}>Last updated: {LAST_UPDATED}</p>
      </section>

      <article className="legal-body">
        <h2>1. Who We Are</h2>
        <p>
          KindFund (&ldquo;KindFund,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the
          fundraising platform at eli54u.com. This Privacy Policy describes how we collect, use, and protect
          your personal information when you use our platform.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>Account information</h3>
        <p>When you register, we collect your email address, full name, and password hash (stored by Supabase Auth). You may optionally provide a profile photo and bio.</p>

        <h3>Campaign information</h3>
        <p>When you create a campaign, we collect your campaign title, story, photos, goal, category, and beneficiary name. This information is displayed publicly on your campaign page.</p>

        <h3>Donation information</h3>
        <p>
          Donation amounts, timestamps, and optional messages are stored in our database. All payment processing is handled by Stripe — we never receive, store, or process your credit card, bank account, or payment credentials directly.
        </p>

        <h3>Usage data</h3>
        <p>We collect standard web server logs (IP address, browser type, pages visited) for security and analytics purposes. We do not sell this data.</p>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To operate and improve the KindFund platform</li>
          <li>To process donations and send receipts via email</li>
          <li>To display campaign information to donors</li>
          <li>To communicate platform updates and support responses</li>
          <li>To detect fraud and ensure platform security</li>
          <li>To comply with legal obligations</li>
        </ul>

        <h2>4. Sharing of Information</h2>
        <p>We share information with the following third parties:</p>
        <ul>
          <li><strong>Stripe</strong> — payment processing and identity verification</li>
          <li><strong>Supabase</strong> — database and authentication infrastructure</li>
          <li><strong>Resend</strong> — transactional email delivery</li>
        </ul>
        <p>We do not sell your personal information to advertisers or data brokers.</p>

        <h2>5. Cookies</h2>
        <p>We use session cookies required for authentication. We do not use advertising or tracking cookies.</p>

        <h2>6. Data Retention</h2>
        <p>We retain your account data as long as your account is active. Donation records are retained for tax and legal compliance purposes (minimum 7 years). You may request account deletion by contacting us.</p>

        <h2>7. Your Rights</h2>
        <p>You may request access to, correction of, or deletion of your personal data by emailing <a href="mailto:privacy@eli54u.com">privacy@eli54u.com</a>. We will respond within 30 days.</p>

        <h2>8. Security</h2>
        <p>We use HTTPS, Supabase Row Level Security, and Stripe&rsquo;s PCI DSS-certified infrastructure to protect your data. No security system is perfect — please use a strong, unique password.</p>

        <h2>9. Children</h2>
        <p>KindFund is not intended for use by children under 13. We do not knowingly collect personal information from children.</p>

        <h2>10. Changes to This Policy</h2>
        <p>We may update this policy. Material changes will be communicated by email or prominent notice on the platform.</p>

        <h2>11. Contact</h2>
        <p>
          Questions? Email us at <a href="mailto:privacy@eli54u.com">privacy@eli54u.com</a>.
        </p>
      </article>
    </div>
  );
}
