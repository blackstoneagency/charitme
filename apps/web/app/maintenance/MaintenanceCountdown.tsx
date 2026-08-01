'use client';

import { useEffect, useState } from 'react';

type TimePart = {
  label: string;
  value: string;
};

function remainingParts(deadline: number, now: number): TimePart[] {
  const totalSeconds = Math.max(0, Math.floor((deadline - now) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [
    { label: 'Days', value: String(days).padStart(2, '0') },
    { label: 'Hours', value: String(hours).padStart(2, '0') },
    { label: 'Minutes', value: String(minutes).padStart(2, '0') },
    { label: 'Seconds', value: String(seconds).padStart(2, '0') },
  ];
}

export default function MaintenanceCountdown({ expectedBackAt }: { expectedBackAt: string }) {
  const deadline = Date.parse(expectedBackAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!Number.isFinite(deadline) || deadline <= now) {
    return <p className="maintenance-status">We will be back shortly.</p>;
  }

  return (
    <div className="maintenance-countdown" aria-label={`Expected back ${new Date(deadline).toLocaleString()}`}>
      {remainingParts(deadline, now).map((part) => (
        <div className="maintenance-time" key={part.label}>
          <strong>{part.value}</strong>
          <span>{part.label}</span>
        </div>
      ))}
    </div>
  );
}
