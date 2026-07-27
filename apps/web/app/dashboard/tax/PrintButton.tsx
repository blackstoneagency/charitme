'use client';

export default function PrintButton() {
  return (
    <button type="button" className="kf-primary no-print" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
