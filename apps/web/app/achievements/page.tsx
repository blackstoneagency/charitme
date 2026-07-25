import type { Metadata } from 'next';
import { formatMoneyShort } from '@shared/currencies';
import { Badge, ProgressBar } from '../../components/ui';
import { requireUser } from '../../lib/auth';
import { syncAndGetBadges, givingLevelFor, listChallengesForUser } from '../../lib/gamification-persist';
import { metricLabel } from '../../lib/challenges-core';
import JoinChallengeButton from './JoinChallengeButton';

export const metadata: Metadata = {
  title: 'Achievements — Badges & Challenges',
  description: 'Track your giving badges, streaks, and community challenges on CharitMe.',
  // Personalized, auth-gated page — keep it out of search indexes.
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const user = await requireUser();
  const { badges, stats } = await syncAndGetBadges(user.id);
  const level = givingLevelFor(stats.totalCents);
  const challenges = await listChallengesForUser(user.id, stats);

  const earned = badges.filter((b) => b.earned);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>🏅 Achievements</h1>
        <p style={{ color: 'var(--t3)', fontSize: 15 }}>
          Your giving journey — badges you’ve earned, your streak, and challenges to take on.
        </p>
      </div>

      {/* Giving level + streak summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--t4)' }}>Giving level</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{level.current.name}</div>
        </div>
        <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--t4)' }}>Total given</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{formatMoneyShort(stats.totalCents, 'usd')}</div>
        </div>
        <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--t4)' }}>Donations</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{stats.donationCount}</div>
        </div>
        <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--t4)' }}>Monthly streak</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>🔥 {stats.monthStreak}</div>
        </div>
      </div>

      {/* Badges */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Badges</h2>
        <p style={{ fontSize: 13, color: 'var(--t4)', marginBottom: 14 }}>{earned.length} of {badges.length} earned</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {badges.map((b) => (
            <div
              key={b.id}
              title={b.description}
              style={{
                border: '1px solid var(--b2)',
                borderRadius: 'var(--rl)',
                padding: 16,
                textAlign: 'center',
                background: b.earned ? 'var(--s1)' : 'transparent',
                opacity: b.earned ? 1 : 0.5,
              }}
            >
              <div style={{ fontSize: 34, filter: b.earned ? 'none' : 'grayscale(1)' }}>{b.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{b.label}</div>
              <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 4 }}>{b.description}</div>
              {b.earned && <div style={{ marginTop: 8 }}><Badge color="green">Earned</Badge></div>}
            </div>
          ))}
        </div>
      </section>

      {/* Challenges */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Community challenges</h2>
        {challenges.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t4)' }}>No active challenges right now — check back soon.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {challenges.map((c) => (
              <div key={c.id} style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>{c.title}</h3>
                      {c.complete && <Badge color="green">Complete</Badge>}
                    </div>
                    {c.description && <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>{c.description}</p>}
                    <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 4 }}>{c.participant_count} participating</div>
                  </div>
                  {!c.joined && !c.complete && <JoinChallengeButton challengeId={c.id} />}
                </div>
                {(c.joined || c.complete) && (
                  <div style={{ marginTop: 12 }}>
                    <ProgressBar value={c.value} max={c.goal_value} />
                    <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 6 }}>
                      {c.metric === 'total_cents'
                        ? `${formatMoneyShort(c.value, 'usd')} of ${formatMoneyShort(c.goal_value, 'usd')} ${metricLabel(c.metric)}`
                        : `${c.value} of ${c.goal_value} ${metricLabel(c.metric)}`}{' '}({c.percent}%)
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
