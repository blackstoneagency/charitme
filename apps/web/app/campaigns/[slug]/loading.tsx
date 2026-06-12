export default function CampaignLoading() {
  return (
    <main className="public-campaign" aria-busy="true" aria-label="Loading campaign">
      <section className="pc-header">
        <div className="pc-skeleton-block" style={{ width: 240, height: 16 }} />
        <div className="pc-skeleton-block" style={{ width: 140, height: 28, borderRadius: 999 }} />
        <div className="pc-skeleton-block" style={{ width: '70%', maxWidth: 560, height: 48 }} />
        <div className="pc-skeleton-block" style={{ width: 280, height: 36 }} />
        <div className="pc-skeleton-block" style={{ width: '100%', height: 88 }} />
      </section>

      <section className="pc-grid">
        <div className="pc-left">
          <div className="pc-skeleton-block" style={{ width: '100%', height: 380 }} />
          <div className="pc-skeleton-block" style={{ width: '100%', height: 320 }} />
        </div>
        <div className="pc-right">
          <div className="pc-skeleton-block" style={{ width: '100%', height: 460 }} />
        </div>
      </section>
    </main>
  );
}
