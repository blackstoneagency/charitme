// Shared loading skeleton for `.container` list/marketplace pages (volunteer,
// matching, sponsor, events, …). Renders a header + a responsive card grid so
// navigating to a data-fetching list page feels instant instead of showing a
// frozen previous screen. Uses the existing `.pc-skeleton-block` shimmer.
export default function ListPageSkeleton({
  cards = 6,
  minCardWidth = 300,
  maxWidth,
  label = 'Loading',
  showFilterBar = true,
}: {
  cards?: number;
  minCardWidth?: number;
  maxWidth?: number;
  label?: string;
  showFilterBar?: boolean;
}) {
  return (
    <div className="container" style={{ padding: '40px 24px', ...(maxWidth ? { maxWidth } : {}) }} role="status" aria-busy="true" aria-label={label}>
      <div style={{ marginBottom: 28 }}>
        <div className="pc-skeleton-block" style={{ width: 300, height: 30, marginBottom: 10 }} />
        <div className="pc-skeleton-block" style={{ width: 460, height: 15, maxWidth: '100%' }} />
      </div>

      {showFilterBar && <div className="pc-skeleton-block" style={{ width: '100%', height: 44, marginBottom: 24 }} />}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`, gap: 20 }}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: 20 }}>
            <div className="pc-skeleton-block" style={{ width: 90, height: 20, borderRadius: 999, marginBottom: 14 }} />
            <div className="pc-skeleton-block" style={{ width: '85%', height: 18, marginBottom: 10 }} />
            <div className="pc-skeleton-block" style={{ width: '100%', height: 13, marginBottom: 6 }} />
            <div className="pc-skeleton-block" style={{ width: '70%', height: 13, marginBottom: 16 }} />
            <div className="pc-skeleton-block" style={{ width: '50%', height: 34 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
