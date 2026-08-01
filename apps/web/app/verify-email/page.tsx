import type { Metadata } from 'next';
import { getTranslator } from '../../lib/locale-server';
import VerifyEmailClient from './VerifyEmailClient';

export const metadata: Metadata = {
  title: 'Verify your email',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const t = await getTranslator();
  // Shown back to the visitor and passed to auth.resend. Supabase validates it
  // server-side and only ever resends to an address that already has a pending
  // signup, so an arbitrary value in the query string cannot be used to mail a
  // stranger.
  const email = typeof sp.email === 'string' ? sp.email.trim().slice(0, 254) : '';

  return (
    <main id="main-content" style={{ maxWidth: 560, margin: '0 auto', padding: '56px 24px 72px', textAlign: 'center' }}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 72, height: 72, borderRadius: 999, marginBottom: 22,
          background: 'var(--tint-violet)', color: 'var(--brand-text)', fontSize: 30,
        }}
      >
        ✉
      </span>
      <h1 style={{ fontSize: 'clamp(26px,4.5vw,34px)', fontWeight: 850, color: 'var(--t1)', margin: '0 0 14px' }}>
        {t('verify.title')}
      </h1>
      <VerifyEmailClient email={email} />
    </main>
  );
}
