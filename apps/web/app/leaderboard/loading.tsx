export default function LeaderboardLoading() {
  return (
    <div className="container" style={{ padding: '40px 24px' }} aria-busy="true" aria-label="Loading leaderboard">
      <div style={{ marginBottom: '28px' }}>
        <div className="pc-skeleton-block" style={{ width: 220, height: 28, marginBottom: 8 }} />
        <div className="pc-skeleton-block" style={{ width: 420, height: 16 }} />
      </div>

      <div className="pc-skeleton-block" style={{ width: 280, height: 40, marginBottom: 20 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="pc-skeleton-block" style={{ width: '100%', height: 64 }} />
        ))}
      </div>
    </div>
  );
}
