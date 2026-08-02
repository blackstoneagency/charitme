import type { Metadata } from 'next';
import Link from 'next/link';
import { API_SCOPES, KEY_PREFIX } from '../../lib/api-keys';

export const metadata: Metadata = {
  title: 'CharitMe API — Developer Documentation',
  description:
    'The CharitMe public REST API. Read your campaigns and donations with a scoped API key. Free, documented, and open to every account.',
  alternates: { canonical: 'https://www.charitme.com/developers' },
};

// Public API documentation.
//
// Deliberately a real page rather than a link to a PDF or a Notion doc: the
// competitive point of this API is that it is OPEN — GoFundMe gates theirs
// behind enterprise sales — and an API whose docs are behind a form is not open
// in the way that matters.

const code = (s: string) => (
  // `overflowX: 'auto'` makes this a scrollable region, so WCAG 2.1.1 requires
  // it to be focusable — otherwise a keyboard-only reader can reach neither the
  // scrollbar nor the part of the sample it hides, which on an API-docs page is
  // the request body. role + aria-label give the focus stop a name instead of
  // announcing as an unlabelled group.
  //
  // jsx-a11y/no-noninteractive-tabindex objects; axe's scrollable-region-
  // focusable is the actual success criterion and it measures the rendered
  // page, so it wins. Same trade as the cookie table on /cookies.
  <pre
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    tabIndex={0}
    role="region"
    aria-label="Code sample"
    style={{
      background: 'var(--s2)',
      border: '1px solid var(--b1)',
      borderRadius: 'var(--r)',
      padding: '14px 16px',
      overflowX: 'auto',
      fontSize: 13,
      fontFamily: 'var(--mono)',
      color: 'var(--t1)',
      margin: '10px 0 0',
      lineHeight: 1.6,
    }}
  >
    {s}
  </pre>
);

function Endpoint({
  method,
  path,
  scope,
  children,
}: {
  method: string;
  path: string;
  scope: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: 18, background: 'var(--s1)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--green-dark)',
            background: 'var(--green-light)',
            borderRadius: 6,
            padding: '2px 8px',
          }}
        >
          {method}
        </span>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{path}</code>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--t3)' }}>{scope}</code>
      </div>
      <div style={{ marginTop: 10, fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export default function DevelopersDocsPage() {
  return (
    <main id="main-content" style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 64px' }}>
      <header style={{ marginBottom: 28 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--violet-ink)',
            marginBottom: 10,
          }}
        >
          Developers
        </span>
        <h1 style={{ fontSize: 36, lineHeight: 1.15, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          The CharitMe API
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          A REST API over your own campaigns and donations. Free on every account, no sales call and
          no enterprise tier — create a key in your dashboard and start reading.
        </p>
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: '0 0 10px' }}>Authentication</h2>
        <p style={{ fontSize: 14.5, color: 'var(--t2)', lineHeight: 1.6, margin: 0 }}>
          Create a key at{' '}
          <Link href="/dashboard/developers" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
            /dashboard/developers
          </Link>
          . Keys start with <code style={{ fontFamily: 'var(--mono)' }}>{KEY_PREFIX}</code> and are shown{' '}
          <strong>once</strong> — CharitMe stores only a hash, so a lost key must be revoked and replaced.
          Send it as a bearer token:
        </p>
        {code(`curl https://www.charitme.com/api/v1/me \\
  -H "Authorization: Bearer ${KEY_PREFIX}your_key_here"`)}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: '0 0 10px' }}>Scopes</h2>
        <p style={{ fontSize: 14.5, color: 'var(--t2)', lineHeight: 1.6, margin: '0 0 10px' }}>
          Every scope is <strong>read-only</strong>, and every endpoint is scoped to the data owned by
          the key&apos;s account. There is no scope that reads another account&apos;s data, and no write
          scope — moving money through an API key is not something we will ship without a design that
          deserves it.
        </p>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14, color: 'var(--t2)', lineHeight: 1.9 }}>
          {API_SCOPES.map((s) => (
            <li key={s}>
              <code style={{ fontFamily: 'var(--mono)' }}>{s}</code>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: '0 0 14px' }}>Endpoints</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <Endpoint method="GET" path="/api/v1/me" scope="profile:read">
            The account a key belongs to, and the scopes it holds. Use it to verify a credential.
          </Endpoint>
          <Endpoint method="GET" path="/api/v1/campaigns" scope="campaigns:read">
            Your campaigns, newest first. Supports <code>?limit=</code> (1–100, default 25) and{' '}
            <code>?offset=</code>. Amounts end in <code>_cents</code> and are integers.
          </Endpoint>
          <Endpoint method="GET" path="/api/v1/donations" scope="donations:read">
            Completed donations to your campaigns. Optional <code>?campaign_id=</code> filter.
            Anonymous donors return <code>donor_name: null</code> and <code>donor_id: null</code> — the
            amount is yours, the identity is theirs.
          </Endpoint>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: '0 0 10px' }}>Response shape</h2>
        <p style={{ fontSize: 14.5, color: 'var(--t2)', lineHeight: 1.6, margin: 0 }}>
          List endpoints share one envelope, so paging works the same everywhere.
        </p>
        {code(`{
  "data": [ … ],
  "pagination": { "limit": 25, "offset": 0, "total": 137 }
}`)}
        <p style={{ fontSize: 14.5, color: 'var(--t2)', lineHeight: 1.6, margin: '14px 0 0' }}>
          Errors are also uniform. Branch on <code style={{ fontFamily: 'var(--mono)' }}>code</code>, not
          on the message:
        </p>
        {code(`{ "error": { "code": "insufficient_scope",
            "message": "This key does not have the \`donations:read\` scope.",
            "required_scope": "donations:read" } }`)}
        <ul style={{ margin: '14px 0 0', padding: '0 0 0 18px', fontSize: 14, color: 'var(--t2)', lineHeight: 1.9 }}>
          <li>
            <code>401 unauthorized</code> — missing, malformed, unknown or revoked key
          </li>
          <li>
            <code>403 insufficient_scope</code> — valid key, wrong scope
          </li>
          <li>
            <code>429 rate_limited</code> — 120 requests per minute, per key
          </li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: '0 0 10px' }}>Example</h2>
        {code(`curl "https://www.charitme.com/api/v1/donations?limit=5" \\
  -H "Authorization: Bearer ${KEY_PREFIX}your_key_here"

{
  "data": [
    { "id": "…", "campaign_id": "…", "amount_cents": 5000,
      "tip_cents": 0, "status": "completed", "anonymous": false,
      "donor_name": "Ada L.", "message": "Rooting for you!",
      "created_at": "2026-07-30T18:04:11.000Z" }
  ],
  "pagination": { "limit": 5, "offset": 0, "total": 1 }
}`)}
      </section>
    </main>
  );
}
