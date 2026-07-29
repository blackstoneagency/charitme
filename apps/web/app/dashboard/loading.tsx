import { CharitMeShell } from '../../components/ShellSessionProvider';

// Dashboard-wide loading skeleton. Rendered inside the shell so the sidebar
// stays put during navigation (instead of the content area freezing on the
// previous page). Covers every dashboard route that lacks its own loading.tsx.
export default function DashboardLoading() {
  return (
    <CharitMeShell active="">
      <div style={{ padding: '28px 32px' }} role="status" aria-busy="true" aria-label="Loading">
        {/* Page title */}
        <div className="pc-skeleton-block" style={{ width: 240, height: 26, marginBottom: 8 }} />
        <div className="pc-skeleton-block" style={{ width: 360, height: 15, maxWidth: '100%', marginBottom: 28 }} />

        {/* Metric row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: '20px 22px' }}>
              <div className="pc-skeleton-block" style={{ width: 100, height: 24, marginBottom: 10 }} />
              <div className="pc-skeleton-block" style={{ width: 70, height: 12 }} />
            </div>
          ))}
        </div>

        {/* Content block */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 16, padding: 24 }}>
          <div className="pc-skeleton-block" style={{ width: 200, height: 18, marginBottom: 18 }} />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: i ? '1px solid var(--b1)' : 'none' }}>
              <div className="pc-skeleton-block" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="pc-skeleton-block" style={{ width: '40%', height: 14, marginBottom: 8 }} />
                <div className="pc-skeleton-block" style={{ width: '65%', height: 12 }} />
              </div>
              <div className="pc-skeleton-block" style={{ width: 70, height: 28, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </CharitMeShell>
  );
}
