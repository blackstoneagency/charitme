// Stripe Connect sample — post-checkout success page.
// The Checkout Session appends ?session_id=… on success; we just confirm here.

export const dynamic = 'force-dynamic';

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '64px 20px', textAlign: 'center', fontFamily: 'var(--font, system-ui, sans-serif)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Payment complete</h1>
      <p style={{ color: 'var(--t3, #6b7280)', fontSize: 15 }}>
        Thanks for your purchase! The funds have been routed to the connected account,
        minus the platform&rsquo;s application fee.
      </p>
      {sessionId && (
        <p style={{ color: 'var(--t4, #9ca3af)', fontSize: 12, marginTop: 12, wordBreak: 'break-all' }}>
          Session: <code>{sessionId}</code>
        </p>
      )}
      <p style={{ marginTop: 24 }}>
        <a href="/connect-sample/storefront" style={{ color: 'var(--green, #16a34a)', fontWeight: 600 }}>← Back to storefront</a>
      </p>
    </main>
  );
}
