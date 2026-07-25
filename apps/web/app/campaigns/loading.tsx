import { Card } from '../../components/ui';

export default function CampaignsLoading() {
  return (
    <div className="container" style={{ padding: '40px 24px' }} aria-busy="true" aria-label="Loading campaigns">
      <div style={{ marginBottom: '28px' }}>
        <div className="pc-skeleton-block" style={{ width: 280, height: 28, marginBottom: 8 }} />
        <div className="pc-skeleton-block" style={{ width: 380, height: 16 }} />
      </div>

      <div className="pc-skeleton-block" style={{ width: '100%', height: 48, marginBottom: 20 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <Card key={i} style={{ height: '100%' }}>
            <div className="pc-skeleton-block" style={{ height: 190, borderRadius: 0 }} />
            <div style={{ padding: '18px' }}>
              <div className="pc-skeleton-block" style={{ width: '80%', height: 16, marginBottom: 10 }} />
              <div className="pc-skeleton-block" style={{ width: '60%', height: 13, marginBottom: 16 }} />
              <div className="pc-skeleton-block" style={{ width: '100%', height: 40, marginBottom: 12 }} />
              <div className="pc-skeleton-block" style={{ width: '100%', height: 8 }} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
