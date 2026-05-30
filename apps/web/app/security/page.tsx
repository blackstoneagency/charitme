import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security — CharitMe',
  description: 'How CharitMe protects your data, payments, and account using industry-standard security controls.',
};

export default function SecurityPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Security</b></div>
        <h1>Security at CharitMe</h1>
        <p>We take security seriously. Here is how we protect your account, payments, and data.</p>
      </section>

      <article className="legal-body">
        <h2>Payment Security</h2>
        <ul>
          <li><strong>Stripe PCI DSS Level 1</strong> — All card payments are processed by Stripe, the highest-certified payment processor. CharitMe never sees, stores, or handles your card number, CVV, or bank account details.</li>
          <li><strong>3D Secure / SCA</strong> — Strong Customer Authentication is supported for European and other regulated transactions.</li>
          <li><strong>Webhook signature verification</strong> — All Stripe webhook events are verified using HMAC-SHA256 signatures before processing.</li>
        </ul>

        <h2>Infrastructure</h2>
        <ul>
          <li><strong>Supabase Postgres</strong> — All data is stored in Supabase with Row Level Security (RLS) policies enforced at the database level. Users can only access their own data.</li>
          <li><strong>HTTPS everywhere</strong> — All traffic is encrypted in transit using TLS 1.2+. HTTP requests are automatically redirected to HTTPS.</li>
          <li><strong>Serverless API routes</strong> — API endpoints run in isolated serverless functions (Vercel Edge Network). No persistent server processes.</li>
          <li><strong>Supabase Auth</strong> — Sessions use secure, HTTP-only cookies with PKCE. Google OAuth sessions are server-initiated to prevent code verifier exposure.</li>
        </ul>

        <h2>Access Controls</h2>
        <ul>
          <li><strong>Row Level Security</strong> — Database queries are restricted so organizers can only read/write their own campaigns, donors their own donations, and admins see everything with audit trail.</li>
          <li><strong>Service role key isolation</strong> — The Supabase service role key (bypasses RLS) is never included in client bundles. It is only used in server-side API route handlers that have already verified authentication.</li>
          <li><strong>Admin email gating</strong> — The admin console is protected by verified admin email list and database role check, in addition to session authentication.</li>
        </ul>

        <h2>Identity Verification</h2>
        <ul>
          <li><strong>Stripe KYC</strong> — Organizers must complete Stripe Connect identity verification (name, DOB, address, SSN last 4) before payouts are enabled.</li>
          <li><strong>Trust Score</strong> — An AI-computed trust score (0–100) is visible on every campaign. It reflects identity verification, story quality, and fundraising activity.</li>
          <li><strong>Verified badge</strong> — Campaigns with fully verified organizers display a CharitMe Verified badge.</li>
        </ul>

        <h2>Data Protection</h2>
        <ul>
          <li><strong>No PII logging</strong> — We do not log email addresses, full names, IP addresses, or card data in application logs.</li>
          <li><strong>Input validation</strong> — All API inputs are validated with Zod schema validation before any database operation.</li>
          <li><strong>SQL injection prevention</strong> — All queries use parameterized statements via the Supabase JS SDK. User input is never concatenated into SQL.</li>
          <li><strong>CSRF protection</strong> — State-changing operations require authenticated sessions with server-verified tokens.</li>
        </ul>

        <h2>Vulnerability Disclosure</h2>
        <p>
          If you discover a security vulnerability, please email{' '}
          <a href="mailto:security@charitme.com">security@charitme.com</a> immediately.
          Do not disclose publicly until we have had 90 days to respond and patch.
          We appreciate responsible disclosure.
        </p>

        <h2>Updates</h2>
        <p>This page is updated when security controls change. Last reviewed: May 2025.</p>
      </article>
    </div>
  );
}
