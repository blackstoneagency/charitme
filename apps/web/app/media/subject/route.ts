import React from 'react';
import { ImageResponse } from 'next/og';
import { z } from 'zod';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  category: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9 _&+/-]+$/),
  key: z.string().trim().min(1).max(160).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
});

const SUBJECT_COPY: Record<string, string> = {
  animal: 'Rescue, protection, and lifelong care',
  business: 'Local ideas and independent opportunity',
  community: 'Neighbors creating practical change together',
  competition: 'Teams, talent, and shared ambition',
  creative: 'Art, expression, and cultural connection',
  education: 'Learning, access, and brighter futures',
  emergency: 'Urgent relief when every hour matters',
  environment: 'Healthy places for people and planet',
  event: 'Gathering people around a shared purpose',
  faith: 'Faith, service, and compassionate action',
  'faith-belief': 'Faith communities serving neighbors with compassion',
  family: 'Stability, care, and a path forward',
  'people-in-need': 'Essentials, stability, and a path forward',
  medical: 'Care, treatment, and recovery',
  'health-wellness': 'Care, treatment, recovery, and healthy lives',
  'mental-health': 'Accessible mental health care and sustained recovery',
  'medical-research': 'Research accelerating better treatment and care',
  memorial: 'Honoring a life through lasting impact',
  nonprofit: 'Mission-driven work with measurable impact',
  sports: 'Access, teamwork, and youth development',
  'sports-youth': 'Access, teamwork, and youth development',
  'sports-recreation': 'Inclusive recreation, teamwork, and healthy activity',
  'community-relief': 'Neighbors delivering practical local relief',
  'animals-planet': 'Animal rescue, protection, and a healthier planet',
  'arts-culture': 'Art, expression, heritage, and cultural connection',
  travel: 'Meaningful journeys and new possibilities',
  volunteer: 'Time and talent put into action',
  wishes: 'Hope made tangible for someone who needs it',
};

const PALETTES = [
  ['#111827', '#ef3f73', '#f59e0b'],
  ['#172554', '#38bdf8', '#f97316'],
  ['#052e2b', '#34d399', '#fbbf24'],
  ['#2e1065', '#c084fc', '#fb7185'],
  ['#3f1d0b', '#fb923c', '#22d3ee'],
  ['#1e293b', '#a3e635', '#f472b6'],
] as const;

function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function words(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* already decoded */ }
  return decoded
    .replace(/^(?:migration-20260903-|cause-(?:card|hero)-|gallery-|campaign-)/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 76);
}

function jsonError(): Response {
  return Response.json(
    { error: 'Invalid subject image parameters', code: 'INVALID_IMAGE_PARAMETERS' },
    { status: 400 },
  );
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    category: url.searchParams.get('category'),
    key: url.searchParams.get('key'),
  });
  if (!parsed.success) return jsonError();

  const category = words(parsed.data.category);
  const title = words(parsed.data.key) || category;
  const categoryKey = parsed.data.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const [base, accent, secondary] = PALETTES[hash(`${categoryKey}:${parsed.data.key}`) % PALETTES.length];
  const subject = SUBJECT_COPY[categoryKey] ?? 'People turning generosity into meaningful action';
  const monogram = category.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CM';

  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          width: '100%', height: '100%', display: 'flex', position: 'relative',
          overflow: 'hidden', background: base, color: '#ffffff',
          fontFamily: 'Arial, sans-serif', padding: '78px',
        },
      },
      React.createElement('div', {
        style: {
          position: 'absolute', inset: '0 0 auto auto', width: '43%', height: '100%',
          display: 'flex', background: accent,
          clipPath: 'polygon(34% 0, 100% 0, 100% 100%, 0 100%)', opacity: 0.92,
        },
      }),
      React.createElement('div', {
        style: {
          position: 'absolute', right: '82px', top: '78px', width: '230px', height: '230px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '8px solid rgba(255,255,255,.9)', background: base,
          color: secondary, fontSize: '92px', fontWeight: 900,
        },
      }, monogram),
      React.createElement(
        'div',
        { style: { width: '68%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '16px', fontSize: '25px', fontWeight: 800 } },
          React.createElement('span', { style: { width: '54px', height: '8px', display: 'flex', background: secondary } }),
          `${category.toUpperCase()} CAMPAIGN`,
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column' } },
          React.createElement('div', { style: { fontSize: '64px', lineHeight: 1.04, fontWeight: 900, maxWidth: '760px' } }, title),
          React.createElement('div', { style: { marginTop: '26px', fontSize: '27px', lineHeight: 1.35, color: '#e5e7eb', maxWidth: '680px' } }, subject),
        ),
        React.createElement('div', { style: { display: 'flex', fontSize: '25px', fontWeight: 800 } }, 'CharitMe'),
      ),
    ),
    { width: 1200, height: 900, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  );
}
