import { describe, expect, it } from 'vitest';
import {
  AI_INTAKE_MAX_FILE_BYTES,
  normalizeAiIntakeLinks,
  parseAiCampaignIntake,
  validateAiIntakeFile,
} from '../lib/campaign-ai-intake';

describe('AI campaign intake', () => {
  it('validates file type and the 5 MB security boundary', () => {
    expect(validateAiIntakeFile({ name: 'plan.pdf', type: 'application/pdf', size: 1200 })).toBeNull();
    expect(validateAiIntakeFile({ name: 'script.exe', type: 'application/octet-stream', size: 1200 })).toContain('not a supported');
    expect(validateAiIntakeFile({ name: 'large.pdf', type: 'application/pdf', size: AI_INTAKE_MAX_FILE_BYTES + 1 })).toContain('smaller than 5 MB');
  });

  it('normalizes, deduplicates, and rejects unsafe links', () => {
    const result = normalizeAiIntakeLinks([
      'https://example.com/plan',
      'https://example.com/plan',
      'javascript:alert(1)',
    ]);
    expect(result.links).toEqual(['https://example.com/plan']);
    expect(result.invalid).toEqual(['javascript:alert(1)']);
  });

  it('parses only the versioned AI handoff contract', () => {
    expect(parseAiCampaignIntake('{}')).toBeNull();
    expect(parseAiCampaignIntake(JSON.stringify({
      version: 1,
      path: 'ai',
      prompt: 'Help rebuild our community kitchen after storm damage.',
      links: ['https://example.com'],
      files: [{ id: 'a', name: 'plan.pdf', type: 'application/pdf', size: 100 }],
      createdAt: 1,
    }))).toMatchObject({ path: 'ai', files: [{ id: 'a' }] });
  });
});
