import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { stripe } from '../../../lib/stripe';
import RemoveMethodButton from './RemoveMethodButton';
import AddMethodButton from './AddMethodButton';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Payment Methods' };

// ─────────────────────────────────────────────────────────────────────────────
// Design 21 — saved payment methods.
//
// ⚠️ CharitMe stores NO card data, and this page does not change that. Every
// value rendered here (brand, last four, expiry, the default flag) is read from
// Stripe at request time via the PaymentMethod API, which returns exactly those
// non-sensitive fields and never a PAN. Nothing is copied into our database, so
// this page adds no PCI scope: the card of record lives at Stripe, and we hold
// only `profiles.stripe_customer_id`, which is a pointer.
//
// Adding a card deliberately goes to the Stripe Billing Portal rather than a
// form here. A card form on our own domain would put us in scope for SAQ A-EP
// instead of SAQ A, for a worse version of a flow Stripe already localises,
// 3DS-challenges and PCI-certifies. "Take great liberty" does not extend to
// re-implementing card capture.
//
// Removing detaches the PaymentMethod at Stripe. It cannot touch a subscription
// silently: the detach is scoped to the customer, and any active subscription
// paying with it will surface at Stripe rather than failing quietly here.
// ─────────────────────────────────────────────────────────────────────────────

type Card = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  /** Expired or expiring within the current month — worth warning about. */
  expired: boolean;
};

type Loaded =
  | { state: 'ok'; cards: Card[] }
  /** No Stripe customer yet — the person has never paid. Not an error. */
  | { state: 'no-customer' }
  /** The read failed. Deliberately distinct from "no cards", which is a fact. */
  | { state: 'unavailable' };

const BRAND_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners Club',
  unionpay: 'UnionPay',
  link: 'Link',
};

function brandLabel(brand: string): string {
  return BRAND_LABEL[brand] ?? (brand ? brand[0].toUpperCase() + brand.slice(1) : 'Card');
}

async function loadCards(userId: string): Promise<Loaded> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) return { state: 'unavailable' };
    const customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) return { state: 'no-customer' };

    // The default method lives on the customer, not on the PaymentMethod, so
    // both reads are needed to render the "Default" badge the design shows.
    const [methods, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 20 }),
      stripe.customers.retrieve(customerId),
    ]);

    const defaultId =
      customer && !('deleted' in customer && customer.deleted)
        ? (typeof customer.invoice_settings?.default_payment_method === 'string'
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings?.default_payment_method?.id) ?? null
        : null;

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    const cards: Card[] = methods.data
      .filter((m) => m.card)
      .map((m) => {
        const c = m.card!;
        return {
          id: m.id,
          brand: brandLabel(c.brand),
          last4: c.last4,
          expMonth: c.exp_month,
          expYear: c.exp_year,
          isDefault: m.id === defaultId,
          expired: c.exp_year < thisYear || (c.exp_year === thisYear && c.exp_month < thisMonth),
        };
      })
      // Default first, then soonest to expire — the order someone scanning the
      // list actually needs.
      .sort((a, b) =>
        a.isDefault === b.isDefault
          ? a.expYear * 12 + a.expMonth - (b.expYear * 12 + b.expMonth)
          : a.isDefault
            ? -1
            : 1,
      );

    return { state: 'ok', cards };
  } catch {
    // `stripe` throws on construction when STRIPE_SECRET_KEY is unset, and
    // `supabaseAdmin` throws on property access when its env is missing. Either
    // way this is "we could not read", not "you have no cards" — and saying the
    // wrong one would tell someone their payment method had vanished.
    return { state: 'unavailable' };
  }
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '22px',
        border: '1px solid var(--b1)',
        borderRadius: 'var(--rl)',
        background: 'var(--s2)',
        maxWidth: '640px',
      }}
    >
      <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 750, color: 'var(--t1)', margin: 0 }}>{title}</h2>
      <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, margin: '8px 0 0' }}>{body}</p>
      {action ? <div style={{ marginTop: '16px' }}>{action}</div> : null}
    </div>
  );
}

export default async function PaymentMethodsPage() {
  const user = await requireUser();
  const loaded = await loadCards(user.id);

  return (
    <CharitMeShell active="settings">
      {/* The action belongs in the TopBar's own slot, beside the title.
          It used to sit in a full-width `space-between` row BELOW the topbar,
          which threw it to the far right of the window — roughly 700px from the
          sentence it was paired with, and past the right edge of every card on
          the page. The row it was in had no horizontal gutter either, so the
          explanatory line under the title started 32px to the LEFT of the
          title. Both are the same root cause: content rendered straight into
          `.kf-main`, which has no padding of its own. */}
      <TopBar
        title="Payment Methods"
        subtitle="Manage your saved payment methods."
        actions={loaded.state !== 'unavailable' ? <AddMethodButton /> : undefined}
      />

      <div className="kf-body">
        <p style={{ fontSize: '14px', color: 'var(--t3)', margin: '0 0 22px' }}>
          Cards are stored by Stripe, our payment processor — CharitMe never sees or keeps your card number.
        </p>

      {loaded.state === 'unavailable' ? (
        <Notice
          title="We couldn't load your payment methods"
          body="This is a problem on our side, not a sign that anything has changed on your account. Nothing has been removed. Please try again in a moment."
          action={
            <Link href="/dashboard/payment-methods" className="cm-touch-link" style={{ color: 'var(--green-text)', fontWeight: 700, fontSize: '14px' }}>
              Try again
            </Link>
          }
        />
      ) : loaded.state === 'no-customer' ? (
        <Notice
          title="No saved payment methods yet"
          body="Once you make your first donation, the card you use can be saved here for next time. You can also add one now."
          action={<AddMethodButton />}
        />
      ) : loaded.cards.length === 0 ? (
        <Notice
          title="No saved payment methods"
          body="You don't have any cards saved. Adding one makes future donations a single tap."
          action={<AddMethodButton />}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '18px' }}>
          {loaded.cards.map((card) => (
            <div
              key={card.id}
              style={{
                padding: '20px',
                border: `1px solid ${card.isDefault ? 'var(--b2)' : 'var(--b1)'}`,
                borderRadius: 'var(--rl)',
                background: 'var(--s1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <strong style={{ fontSize: '15px', color: 'var(--t1)' }}>{card.brand}</strong>
                {card.isDefault ? (
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.04em', color: 'var(--green-text)', textTransform: 'uppercase' }}>
                    Default
                  </span>
                ) : null}
              </div>

              <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--t2)', letterSpacing: '.08em' }}>
                •••• {card.last4}
              </div>

              <div style={{ fontSize: '13px', color: card.expired ? 'var(--red-text, var(--red))' : 'var(--t3)' }}>
                {card.expired ? 'Expired ' : 'Expires '}
                {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
              </div>

              <div style={{ display: 'flex', minWidth: 0, gap: '10px', marginTop: '4px' }}>
                <RemoveMethodButton id={card.id} label={`${card.brand} ending ${card.last4}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '8px', marginTop: '26px', fontSize: '13px', color: 'var(--t3)' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        Your payment information is secure and encrypted, and is held by Stripe rather than by CharitMe.
      </p>
      </div>
    </CharitMeShell>
  );
}
