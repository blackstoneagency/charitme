import Link from 'next/link';
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  isPaidPlan,
  type PlanEntitlements,
} from '@shared/entitlements';

function price(cents: number, planId: string): string {
  if (planId === 'enterprise') return 'Custom pricing';
  if (cents === 0) return 'Free';
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}/mo`;
}

function limitLabel(n: number | null): string {
  return n === null ? 'Unlimited' : String(n);
}

/**
 * Read-only view of the signed-in user's current plan, limits, and unlocked
 * features — resolved from the entitlement model (`@shared/entitlements`).
 */
export default function PlanFeaturesCard({
  entitlements,
  activeCampaigns,
}: {
  entitlements: PlanEntitlements;
  activeCampaigns: number;
}) {
  const { name, planId, monthlyPriceCents, limits, features } = entitlements;
  const paid = isPaidPlan(planId);
  const atCampaignLimit = limits.activeCampaigns !== null && activeCampaigns >= limits.activeCampaigns;

  return (
    <section
      style={{
        background: 'var(--s1)',
        border: '1px solid var(--b2)',
        borderRadius: 14,
        padding: '20px 22px',
        margin: '0 0 20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Your plan
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginTop: 4 }}>{name}</div>
          <div style={{ fontSize: 14, color: 'var(--t3)', marginTop: 2 }}>{price(monthlyPriceCents, planId)}</div>
        </div>
        <Link
          href="/pricing"
          style={{
            padding: '9px 18px',
            borderRadius: 10,
            background: paid ? 'transparent' : 'var(--violet, var(--violet))',
            color: paid ? 'var(--violet, var(--violet))' : '#fff',
            border: paid ? '1.5px solid var(--b2)' : 'none',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {planId === 'enterprise' ? 'Compare plans' : paid ? 'Change plan' : 'Upgrade'}
        </Link>
      </div>

      {/* Limits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 18 }}>
        <Stat
          label="Active campaigns"
          value={`${activeCampaigns} / ${limitLabel(limits.activeCampaigns)}`}
          warn={atCampaignLimit}
        />
        <Stat label="AI generations / mo" value={limitLabel(limits.aiGenerationsPerMonth)} />
        <Stat label="Team seats" value={String(limits.teamSeats)} />
      </div>

      {/* Feature checklist */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Included features
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 16px' }}>
          {FEATURE_KEYS.map((key) => {
            const on = features[key] === true;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: on ? 'var(--t1)' : 'var(--t4)' }}>
                <span
                  aria-hidden
                  style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? 'var(--green, var(--green))' : 'var(--s2)',
                    color: on ? '#fff' : 'var(--t4)',
                    fontSize: 11, fontWeight: 800,
                  }}
                >
                  {on ? '✓' : '·'}
                </span>
                <span style={{ textDecoration: on ? 'none' : 'none' }}>{FEATURE_LABELS[key]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!paid && (
        <p style={{ fontSize: 12.5, color: 'var(--t4)', margin: '16px 0 0', lineHeight: 1.6 }}>
          CharitMe is always free to raise money with a 0% platform fee. Paid plans add optional AI,
          analytics, and team tools — <Link href="/pricing" style={{ color: 'var(--violet, var(--violet))', fontWeight: 600 }}>see what&apos;s included</Link>.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: warn ? 'var(--red, var(--red))' : 'var(--t1)', marginTop: 3 }}>{value}</div>
    </div>
  );
}
