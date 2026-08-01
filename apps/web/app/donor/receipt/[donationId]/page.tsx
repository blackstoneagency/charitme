import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireUser } from '../../../../lib/auth';
import { loadReceiptForUser } from '../../../../lib/receipt-load';
import ReceiptButton from '../../ReceiptButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your receipt',
  // A receipt is a private financial document. It must never be indexed, and the
  // referrer must not carry the donation id to whatever the visitor clicks next.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/**
 * Receipt preview (design #137).
 *
 * The panel is an <iframe> pointed at `GET /api/donations/receipt`, which
 * returns the document `sendReceiptEmail` would send — rendered by the same
 * `receipt-template` functions. A preview built from its own markup is worse
 * than none: it looks right on the day the real receipt is broken, and it drifts
 * silently. Same reasoning as the donation widget.
 *
 * Authorization is `loadReceiptForUser`, the single path the resend endpoint
 * uses. This page runs it once to decide whether the receipt exists for this
 * visitor at all, so the iframe is never rendered around a 403.
 */
export default async function ReceiptPreviewPage({
  params,
}: {
  params: Promise<{ donationId: string }>;
}) {
  const user = await requireUser();
  const { donationId } = await params;
  const loaded = await loadReceiptForUser(donationId, user);

  // A donation this visitor may not see is indistinguishable from one that does
  // not exist — deliberately. Telling them apart would confirm that a given
  // donation id is real to anyone who guesses one.
  if (!loaded.ok && (loaded.status === 403 || loaded.status === 404)) notFound();

  if (!loaded.ok) {
    return (
      <div className="pub-page simple-public">
        <section>
          <h1>Receipt unavailable</h1>
          <p>{loaded.error}</p>
          <p><Link href="/donor">Back to your giving history</Link></p>
        </section>
      </div>
    );
  }

  const { donation, isTaxReceipt, donorEmail } = loaded;

  return (
    <div className="pub-page simple-public">
      <section>
        <div className="pub-breadcrumb">
          <Link href="/donor">Giving History</Link> <span>&gt;</span> <b>Receipt</b>
        </div>
        <h1>{isTaxReceipt ? 'Your tax receipt' : 'Your receipt'}</h1>
        <p>
          For your {new Date(donation.createdAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })} donation to <strong>{donation.campaignTitle}</strong>.
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--t3)' }}>
          {/* Say which copy this is. "Preview" invites the reasonable worry that
              the real one differs. */}
          This is the receipt itself — the same document that was emailed to you,
          rendered from the same template.
        </p>
      </section>

      <section>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <ReceiptButton donationId={donation.id} />
          <a
            href={`/api/donations/receipt?donationId=${encodeURIComponent(donation.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-text)' }}
          >
            Open in a new tab to print or save as PDF ↗
          </a>
          {donorEmail && (
            <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>
              Emails go to <strong style={{ color: 'var(--t2)' }}>{donorEmail}</strong>
            </span>
          )}
        </div>

        <iframe
          src={`/api/donations/receipt?donationId=${encodeURIComponent(donation.id)}`}
          title={`Receipt for your donation to ${donation.campaignTitle}`}
          style={{
            width: '100%', height: 780, border: '1px solid var(--b1)',
            // theme-keep: this is the email document's own page colour. The
            // receipt is a fixed light-mode document that renders identically in
            // every mail client; tinting its frame to the site theme would show
            // the donor something the emailed copy does not look like.
            borderRadius: 'var(--rl)', background: '#f5f5f7', /* theme-keep */
          }}
        />
      </section>

      <section>
        <p style={{ fontSize: 13, color: 'var(--t3)', maxWidth: 720 }}>
          {isTaxReceipt
            ? 'Keep this for your records. Deductibility is determined by the receiving organization’s status, not by CharitMe — consult your tax advisor.'
            : 'Donations to personal fundraisers are not tax-deductible. A campaign run by a verified nonprofit issues an official tax receipt instead of this one.'}
        </p>
        <p><Link href="/donor">← Back to your giving history</Link></p>
      </section>
    </div>
  );
}
