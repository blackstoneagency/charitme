import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CharitMe — Raise More, Faster With AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1b0f4a 0%, #4015e8 55%, #b84aff 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ position: 'relative', width: 88, height: 76, display: 'flex' }}>
            <div style={{ position: 'absolute', left: 6, top: 8, width: 54, height: 54, borderRadius: '34px 34px 10px 34px', transform: 'rotate(45deg)', background: 'linear-gradient(135deg, #7c55ff, #be6bff)', display: 'flex' }} />
            <div style={{ position: 'absolute', right: 6, top: 8, width: 54, height: 54, borderRadius: '34px 34px 10px 34px', transform: 'rotate(45deg)', background: 'linear-gradient(135deg, #b84aff, #6d35ff)', opacity: 0.9, display: 'flex' }} />
          </div>
          <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex' }}>CharitMe</div>
        </div>
        <div style={{ marginTop: 30, fontSize: 38, fontWeight: 800, textAlign: 'center', maxWidth: 900, display: 'flex' }}>
          Raise More, Faster — With AI
        </div>
        <div style={{ marginTop: 18, fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.85)', display: 'flex' }}>
          0% Platform Fees · AI-Powered Fundraising
        </div>
      </div>
    ),
    { ...size }
  );
}
