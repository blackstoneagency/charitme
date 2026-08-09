import { CharitMeShell } from '../../components/ShellSessionProvider';

// Loading skeleton for the donor portal — mirrors the page layout (header,
// 4-stat row, content cards) so navigation feels instant instead of showing a
// frozen previous screen while the server component fetches donations.
//
// ⚠️ Rendered INSIDE the shell, and that is the whole point of the file rather
// than a detail. The page gained the left navigation; a skeleton without it
// would tear the sidebar away for the length of the fetch and slam it back —
// on the one screen whose fetch is slowest, because it aggregates every
// donation the visitor has ever made. The comment above already promised this
// file mirrors the page; the shell is now part of what that means.
//
// The client `CharitMeShell` reads the session from ShellSessionProvider
// (app/donor/layout.tsx), so it needs no await and paints immediately.
export default function DonorLoading() {
  const card: React.CSSProperties = {
    background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14,
    padding: '20px 24px',
  };
  return (
    <CharitMeShell active="Giving History">
      <div
        className="kf-content-grid"
        style={{ gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 860 }}
        role="status"
        aria-busy="true"
        aria-label="Loading your giving history"
      >
        <div style={{ marginBottom: 28 }}>
          <div className="pc-skeleton-block" style={{ width: 240, height: 28, marginBottom: 8 }} />
          <div className="pc-skeleton-block" style={{ width: 360, maxWidth: '100%', height: 15 }} />
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
    </CharitMeShell>
  );
}
