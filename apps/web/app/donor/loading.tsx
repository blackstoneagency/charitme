// Loading skeleton for the donor portal — mirrors the page layout (header,
// 4-stat row, content cards) so navigation feels instant instead of showing a
// frozen previous screen while the server component fetches donations.
export default function DonorLoading() {
  const card: React.CSSProperties = {
    background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14,
    padding: '20px 24px',
  };
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }} role="status" aria-busy="true" aria-label="Loading your giving history">
      <div style={{ marginBottom: 28 }}>
        <div className="pc-skeleton-block" style={{ width: 240, height: 28, marginBottom: 8 }} />
        <div className="pc-skeleton-block" style={{ width: 360, height: 15 }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ ...card, textAlign: 'center' }}>
            <div className="pc-skeleton-block" style={{ width: 90, height: 22, margin: '0 auto 8px' }} />
            <div className="pc-skeleton-block" style={{ width: 70, height: 12, margin: '0 auto' }} />
          </div>
        ))}
      </div>

      {/* Content cards */}
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} style={{ ...card, marginBottom: 24 }}>
          <div className="pc-skeleton-block" style={{ width: 180, height: 18, marginBottom: 16 }} />
          <div className="pc-skeleton-block" style={{ width: '100%', height: 14, marginBottom: 10 }} />
          <div className="pc-skeleton-block" style={{ width: '80%', height: 14 }} />
        </div>
      ))}
    </div>
  );
}
