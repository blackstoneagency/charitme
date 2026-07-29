import { CharitMeShell } from '../../components/ShellSessionProvider';

// Admin-console-wide loading skeleton. Rendered inside the admin shell so the
// sidebar stays put during navigation; covers every /admin route that lacks its
// own loading.tsx. The client shell renders static nav with no data fetch, so
// the loading boundary stays instant.
export default function AdminLoading() {
  return (
    <CharitMeShell active="" mode="admin">
      <div style={{ padding: '28px 32px' }} role="status" aria-busy="true" aria-label="Loading">
        <div className="pc-skeleton-block" style={{ width: 220, height: 26, marginBottom: 8 }} />
        <div className="pc-skeleton-block" style={{ width: 340, height: 15, maxWidth: '100%', marginBottom: 28 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: '20px 22px' }}>
              <div className="pc-skeleton-block" style={{ width: 100, height: 24, marginBottom: 10 }} />
              <div className="pc-skeleton-block" style={{ width: 70, height: 12 }} />
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 16, padding: 24 }}>
          <div className="pc-skeleton-block" style={{ width: 200, height: 18, marginBottom: 18 }} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: i ? '1px solid var(--b1)' : 'none' }}>
              <div className="pc-skeleton-block" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="pc-skeleton-block" style={{ width: '35%', height: 14, marginBottom: 8 }} />
                <div className="pc-skeleton-block" style={{ width: '60%', height: 12 }} />
              </div>
              <div className="pc-skeleton-block" style={{ width: 80, height: 28, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </CharitMeShell>
  );
}
