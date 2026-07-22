import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CharitMe AI fundraising platform';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          color: '#070a2f',
          padding: 72,
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 22,
              background: '#6d35ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            C
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 42, fontWeight: 900 }}>CharitMe</div>
            <div style={{ fontSize: 20, color: '#5e668c', fontWeight: 700 }}>
              AI fundraising that helps campaigns grow
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>
          <div style={{ fontSize: 76, lineHeight: 0.98, fontWeight: 900, letterSpacing: 0 }}>
            Raise more faster with your AI fundraising team.
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.35, color: '#303859', fontWeight: 700 }}>
            Campaigns, donations, grants, events, matching gifts, sponsorships, and impact reporting in one trusted platform.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {['0% platform fees', 'Supabase-powered', 'Built for trust'].map((label) => (
            <div
              key={label}
              style={{
                border: '2px solid #e4e7f5',
                borderRadius: 18,
                padding: '14px 20px',
                fontSize: 22,
                fontWeight: 900,
                color: '#181d43',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
