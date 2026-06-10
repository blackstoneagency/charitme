import { formatCents } from '../../../lib/stripe';

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  target_amount: number | null;
  reached_at: string | null;
}

export default function Milestones({ milestones, raisedCents }: { milestones: Milestone[]; raisedCents: number }) {
  if (milestones.length === 0) return null;

  return (
    <div className="pc-milestones">
      <h3 className="pc-milestones-title">🎯 Milestones &amp; stretch goals</h3>
      <ul className="pc-milestones-list">
        {milestones.map((m) => {
          const reached = !!m.reached_at || (m.target_amount != null && raisedCents >= m.target_amount);
          const pct = m.target_amount ? Math.min(100, Math.round((raisedCents / m.target_amount) * 100)) : null;
          return (
            <li key={m.id} className={`pc-milestone${reached ? ' reached' : ''}`}>
              <span className="pc-milestone-icon" aria-hidden="true">{reached ? '✅' : '⚪'}</span>
              <div className="pc-milestone-body">
                <div className="pc-milestone-title">{m.title}</div>
                {m.description && <div className="pc-milestone-desc">{m.description}</div>}
                {m.target_amount != null && (
                  <>
                    <div className="pc-milestone-meta">
                      {reached ? `Reached — ${formatCents(m.target_amount)}` : `${pct}% to ${formatCents(m.target_amount)}`}
                    </div>
                    {!reached && pct !== null && (
                      <div className="pc-milestone-bar"><span style={{ width: `${pct}%` }} /></div>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
